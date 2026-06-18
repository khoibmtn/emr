from fastapi.testclient import TestClient

from emr.api.app import create_app


def test_create_app_registers_health_route() -> None:
    app = create_app()
    client = TestClient(app)

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert any(route.path == "/api/health" for route in app.routes)
