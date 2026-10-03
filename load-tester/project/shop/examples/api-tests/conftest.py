import os
import uuid

import pytest
import requests


@pytest.fixture(scope="session")
def base_url():
    return os.getenv("BASE_URL", "http://localhost:8000").rstrip("/")


@pytest.fixture(scope="session")
def session():
    with requests.Session() as client:
        yield client


@pytest.fixture(scope="session")
def token(session, base_url):
    response = session.post(base_url + "/api/login",
                            json={"email": "user0001@shop.lab", "password": "password"}, timeout=30)
    assert response.status_code == 200, response.text
    return response.json()["token"]


@pytest.fixture
def headers(token):
    return {"Authorization": "Bearer " + token}


@pytest.fixture
def own_headers(session, base_url):
    # Отдельный пользователь для каждого изменяющего теста исключает зависимость от порядка.
    credentials = {"email": f"test-{uuid.uuid4().hex}@shop.lab", "password": "password"}
    response = session.post(base_url + "/api/register", json=credentials, timeout=30)
    assert response.status_code == 201, response.text
    response = session.post(base_url + "/api/login", json=credentials, timeout=30)
    assert response.status_code == 200, response.text
    return {"Authorization": "Bearer " + response.json()["token"]}
