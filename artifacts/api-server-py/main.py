import os
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import health, stream, proxy, nontongo, moviebox, ytproxy

app = FastAPI(title="hoodTV API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length", "Content-Type"],
)

app.include_router(ytproxy.router,   prefix="/api")
app.include_router(health.router,    prefix="/api")
app.include_router(stream.router,    prefix="/api")
app.include_router(proxy.router,     prefix="/api")
app.include_router(nontongo.router,  prefix="/api")
app.include_router(moviebox.router,  prefix="/api")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
