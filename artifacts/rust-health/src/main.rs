use actix_web::{web, App, HttpServer, HttpResponse, Responder};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::time::timeout;

#[derive(Clone, Debug, Serialize, PartialEq)]
enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}

struct DomainTracker {
    state: CircuitState,
    failures: u32,
    successes: u32,
    last_check: Instant,
}

impl DomainTracker {
    fn new() -> Self {
        Self {
            state: CircuitState::Closed,
            failures: 0,
            successes: 0,
            last_check: Instant::now(),
        }
    }

    fn should_try(&mut self) -> bool {
        match self.state {
            CircuitState::Closed => true,
            CircuitState::Open => {
                if self.last_check.elapsed() > Duration::from_secs(30) {
                    self.state = CircuitState::HalfOpen;
                    true
                } else {
                    false
                }
            }
            CircuitState::HalfOpen => true,
        }
    }

    fn record_success(&mut self) {
        self.failures = 0;
        self.successes += 1;
        self.state = CircuitState::Closed;
        self.last_check = Instant::now();
    }

    fn record_failure(&mut self) {
        self.successes = 0;
        self.failures += 1;
        self.last_check = Instant::now();
        if self.failures >= 3 {
            self.state = CircuitState::Open;
        }
    }

    fn state_label(&self) -> &'static str {
        match self.state {
            CircuitState::Closed => "closed",
            CircuitState::Open => "open",
            CircuitState::HalfOpen => "half-open",
        }
    }
}

type HealthStore = Arc<Mutex<HashMap<String, DomainTracker>>>;

#[derive(Serialize)]
struct ServiceHealth {
    status: &'static str,
    service: &'static str,
    version: &'static str,
    language: &'static str,
    domains_tracked: usize,
}

#[derive(Deserialize)]
struct CdnQuery {
    url: Option<String>,
}

#[derive(Serialize)]
struct CdnCheckResult {
    url: String,
    domain: String,
    reachable: bool,
    circuit: String,
    latency_ms: Option<u64>,
    message: String,
}

#[derive(Serialize)]
struct StatusEntry {
    circuit: String,
    failures: u32,
    successes: u32,
}

async fn health(store: web::Data<HealthStore>) -> impl Responder {
    let store = store.lock().unwrap();
    HttpResponse::Ok()
        .insert_header(("Access-Control-Allow-Origin", "*"))
        .json(ServiceHealth {
            status: "ok",
            service: "rust-health",
            version: "1.0.0",
            language: "Rust",
            domains_tracked: store.len(),
        })
}

async fn check_cdn(
    query: web::Query<CdnQuery>,
    store: web::Data<HealthStore>,
    client: web::Data<Client>,
) -> impl Responder {
    let raw_url = match &query.url {
        Some(u) if !u.is_empty() => u.clone(),
        _ => {
            return HttpResponse::BadRequest()
                .insert_header(("Access-Control-Allow-Origin", "*"))
                .json(serde_json::json!({"error": "url query param required"}));
        }
    };

    let domain = {
        let parts: Vec<&str> = raw_url.splitn(4, '/').collect();
        if parts.len() >= 3 {
            parts[2].to_string()
        } else {
            raw_url.clone()
        }
    };

    let should_try = {
        let mut s = store.lock().unwrap();
        let tracker = s.entry(domain.clone()).or_insert_with(DomainTracker::new);
        tracker.should_try()
    };

    if !should_try {
        return HttpResponse::Ok()
            .insert_header(("Access-Control-Allow-Origin", "*"))
            .json(CdnCheckResult {
                url: raw_url,
                domain,
                reachable: false,
                circuit: "open".into(),
                latency_ms: None,
                message: "Circuit breaker OPEN — CDN marked unhealthy, cooling down".into(),
            });
    }

    let start = Instant::now();
    let result = timeout(
        Duration::from_secs(5),
        client.head(&raw_url).send(),
    )
    .await;
    let elapsed_ms = start.elapsed().as_millis() as u64;

    let (reachable, circuit_label, message) = match result {
        Ok(Ok(resp)) if resp.status().as_u16() < 500 => {
            let mut s = store.lock().unwrap();
            if let Some(t) = s.get_mut(&domain) {
                t.record_success();
            }
            (
                true,
                "closed".to_string(),
                format!("CDN reachable in {}ms (HTTP {})", elapsed_ms, resp.status()),
            )
        }
        Ok(Ok(resp)) => {
            let mut s = store.lock().unwrap();
            if let Some(t) = s.get_mut(&domain) {
                t.record_failure();
            }
            (
                false,
                "failure".to_string(),
                format!("CDN returned HTTP {}", resp.status()),
            )
        }
        Ok(Err(e)) => {
            let mut s = store.lock().unwrap();
            if let Some(t) = s.get_mut(&domain) {
                t.record_failure();
            }
            (false, "failure".to_string(), format!("Request error: {}", e))
        }
        Err(_) => {
            let mut s = store.lock().unwrap();
            if let Some(t) = s.get_mut(&domain) {
                t.record_failure();
            }
            (false, "timeout".to_string(), "CDN request timed out (5s)".into())
        }
    };

    HttpResponse::Ok()
        .insert_header(("Access-Control-Allow-Origin", "*"))
        .json(CdnCheckResult {
            url: raw_url,
            domain,
            reachable,
            circuit: circuit_label,
            latency_ms: if reachable { Some(elapsed_ms) } else { None },
            message,
        })
}

async fn cdn_status(store: web::Data<HealthStore>) -> impl Responder {
    let store = store.lock().unwrap();
    let statuses: HashMap<String, StatusEntry> = store
        .iter()
        .map(|(domain, tracker)| {
            (
                domain.clone(),
                StatusEntry {
                    circuit: tracker.state_label().to_string(),
                    failures: tracker.failures,
                    successes: tracker.successes,
                },
            )
        })
        .collect();

    HttpResponse::Ok()
        .insert_header(("Access-Control-Allow-Origin", "*"))
        .json(serde_json::json!({
            "service": "rust-health",
            "language": "Rust",
            "domains": statuses
        }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8091".to_string());

    let store: HealthStore = Arc::new(Mutex::new(HashMap::new()));

    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("hoodTV-health/1.0 (Rust)")
        .build()
        .expect("Failed to build HTTP client");

    println!("[rust-health] hoodTV CDN Health Service starting on :{}", port);

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(store.clone()))
            .app_data(web::Data::new(client.clone()))
            .route("/health", web::get().to(health))
            .route("/health/cdn", web::get().to(check_cdn))
            .route("/health/status", web::get().to(cdn_status))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}
