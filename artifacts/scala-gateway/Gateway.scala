//> using scala "3.3.4"

import com.sun.net.httpserver.{HttpServer, HttpHandler, HttpExchange}
import java.net.{InetSocketAddress, HttpURLConnection, URL, URLEncoder}
import java.io.{InputStream, OutputStream}
import java.nio.charset.StandardCharsets
import java.util.concurrent.Executors
import scala.util.Try
import scala.jdk.CollectionConverters.*

val PYTHON_URL = sys.env.getOrElse("PYTHON_URL", "http://localhost:8080")
val RUST_URL   = sys.env.getOrElse("RUST_URL",   "http://localhost:9000")
val GO_URL     = sys.env.getOrElse("GO_URL",     "http://localhost:8099")
val PORT       = sys.env.getOrElse("PORT", "8000").toInt

def corsHeaders: Map[String, String] = Map(
  "Access-Control-Allow-Origin"  -> "*",
  "Access-Control-Allow-Methods" -> "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers" -> "*",
  "X-Gateway"                    -> "scala-gateway/1.0",
)

def sendJson(ex: HttpExchange, code: Int, json: String): Unit =
  val bytes = json.getBytes(StandardCharsets.UTF_8)
  corsHeaders.foreach { (k, v) => ex.getResponseHeaders.set(k, v) }
  ex.getResponseHeaders.set("Content-Type", "application/json; charset=utf-8")
  ex.sendResponseHeaders(code, bytes.length)
  ex.getResponseBody.write(bytes)
  ex.getResponseBody.close()

def httpGet(url: String, connectMs: Int = 3000, readMs: Int = 30000): (Int, Array[Byte], String) =
  val conn = URL(url).openConnection().asInstanceOf[HttpURLConnection]
  conn.setConnectTimeout(connectMs)
  conn.setReadTimeout(readMs)
  conn.setRequestProperty("User-Agent", "hoodTV-scala-gateway/1.0")
  conn.setRequestProperty("Accept", "*/*")
  try
    val code = conn.getResponseCode
    val ct   = Option(conn.getContentType).getOrElse("application/json")
    val body = Try(conn.getInputStream.readAllBytes()).getOrElse(Array.emptyByteArray)
    (code, body, ct)
  finally
    conn.disconnect()

def proxyTo(ex: HttpExchange, base: String): Unit =
  val uri   = ex.getRequestURI.toString
  val target = s"$base$uri"
  Try(httpGet(target)) match
    case scala.util.Success((code, body, ct)) =>
      corsHeaders.foreach { (k, v) => ex.getResponseHeaders.set(k, v) }
      ex.getResponseHeaders.set("Content-Type", ct)
      ex.sendResponseHeaders(code, body.length)
      ex.getResponseBody.write(body)
      ex.getResponseBody.close()
    case scala.util.Failure(_) =>
      val msg = """{"error":"upstream service unavailable"}""".getBytes
      corsHeaders.foreach { (k, v) => ex.getResponseHeaders.set(k, v) }
      ex.getResponseHeaders.set("Content-Type", "application/json")
      ex.sendResponseHeaders(503, msg.length)
      ex.getResponseBody.write(msg)
      ex.getResponseBody.close()

def ping(url: String): String =
  Try(httpGet(url, 2000, 2000)).map { (code, _, _) =>
    if code == 200 then "ok" else "degraded"
  }.getOrElse("down")

val handler: HttpHandler = ex =>
  val path   = ex.getRequestURI.getPath
  val method = ex.getRequestMethod

  if method == "OPTIONS" then
    corsHeaders.foreach { (k, v) => ex.getResponseHeaders.set(k, v) }
    ex.sendResponseHeaders(204, -1)
  else if path == "/api/health" then
    val py    = ping(s"$PYTHON_URL/health")
    val rust  = ping(s"$RUST_URL/health")
    val go    = ping(s"$GO_URL/health")
    val all   = Seq(py, rust, go)
    val overall = if all.forall(_ == "ok") then "ok" else "degraded"
    val json = s"""{"status":"$overall","service":"scala-gateway","version":"1.0.0","language":"Scala","backends":{"python":"$py","rust":"$rust","go":"$go"}}"""
    sendJson(ex, 200, json)
  else if path.startsWith("/api/health/") then
    proxyTo(ex, RUST_URL)
  else if path.startsWith("/health") then
    sendJson(ex, 200, """{"status":"ok","service":"scala-gateway","version":"1.0.0","language":"Scala"}""")
  else
    proxyTo(ex, PYTHON_URL)

@main def run(): Unit =
  val server = HttpServer.create(InetSocketAddress("0.0.0.0", PORT), 256)
  server.createContext("/", handler)
  server.setExecutor(Executors.newCachedThreadPool())
  server.start()
  println(s"[scala-gateway] hoodTV Scala API Gateway listening on :$PORT")
  println(s"[scala-gateway]   Python  → $PYTHON_URL")
  println(s"[scala-gateway]   Rust    → $RUST_URL")
  println(s"[scala-gateway]   Go      → $GO_URL")
