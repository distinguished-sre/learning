import uuid


def test_healthz(session, base_url):
    response = session.get(base_url + "/healthz", timeout=10)
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["X-Request-ID"]


def test_readyz(session, base_url):
    response = session.get(base_url + "/readyz", timeout=15)
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_login_ok(session, base_url):
    response = session.post(base_url + "/api/login",
                            json={"email": "user0001@shop.lab", "password": "password"}, timeout=30)
    assert response.status_code == 200
    assert len(response.json()["token"]) == 64
    assert response.json()["expires_in"] > 0


def test_login_wrong_password(session, base_url):
    response = session.post(base_url + "/api/login",
                            json={"email": "user0001@shop.lab", "password": "wrong"}, timeout=30)
    assert response.status_code == 401


def test_register_duplicate_and_validation(session, base_url):
    data = {"email": f"register-{uuid.uuid4().hex}@shop.lab", "password": "password"}
    response = session.post(base_url + "/api/register", json=data, timeout=30)
    assert response.status_code == 201
    assert response.json()["email"] == data["email"]
    assert session.post(base_url + "/api/register", json=data, timeout=30).status_code == 409
    assert session.post(base_url + "/api/register",
                        json={"email": "invalid", "password": "short"}, timeout=10).status_code == 422


def test_products_and_pagination(session, base_url):
    first = session.get(base_url + "/api/products", params={"page": 1, "size": 5}, timeout=10)
    second = session.get(base_url + "/api/products", params={"page": 2, "size": 5}, timeout=10)
    assert first.status_code == second.status_code == 200
    a, b = first.json(), second.json()
    assert a["page"] == 1 and b["page"] == 2 and a["size"] == b["size"] == 5
    assert a["total"] == b["total"] == 10000
    assert len(a["items"]) == len(b["items"]) == 5
    assert {p["id"] for p in a["items"]}.isdisjoint({p["id"] for p in b["items"]})
    assert {"id", "name", "price", "category_id", "stock"} <= a["items"][0].keys()
    assert session.get(base_url + "/api/products", params={"size": 101}, timeout=10).status_code == 422


def test_categories_and_search(session, base_url):
    response = session.get(base_url + "/api/categories", timeout=10)
    assert response.status_code == 200 and len(response.json()) == 20
    response = session.get(base_url + "/api/products", params={"category_id": 1, "q": "Товар"}, timeout=10)
    assert response.status_code == 200
    assert response.json()["items"]
    assert all(p["category_id"] == 1 and "Товар" in p["name"] for p in response.json()["items"])


def test_product_missing(session, base_url):
    assert session.get(base_url + "/api/products/99999999", timeout=10).status_code == 404


def test_auth_required(session, base_url):
    for path in ("/api/cart", "/api/orders"):
        assert session.get(base_url + path, timeout=10).status_code == 401
        assert session.get(base_url + path, headers={"Authorization": "Bearer missing"}, timeout=10).status_code == 401


def test_cart_add_remove(session, base_url, own_headers):
    url = base_url + "/api/cart/items"
    response = session.post(url, headers=own_headers, json={"product_id": 1, "qty": 2}, timeout=10)
    assert response.status_code == 201
    assert response.json()["items"][0]["qty"] == 2
    assert response.json()["total"] == response.json()["items"][0]["price"] * 2
    assert session.get(base_url + "/api/cart", headers=own_headers, timeout=10).json()["items"]
    assert session.delete(url + "/1", headers=own_headers, timeout=10).status_code == 204
    assert session.get(base_url + "/api/cart", headers=own_headers, timeout=10).json() == {"items": [], "total": 0}
    assert session.post(url, headers=own_headers, json={"product_id": 1, "qty": 0}, timeout=10).status_code == 422
    assert session.post(url, headers=own_headers, json={"product_id": 99999999, "qty": 1}, timeout=10).status_code == 404


def test_create_and_find_order(session, base_url, own_headers):
    assert session.post(base_url + "/api/orders", headers=own_headers, timeout=15).status_code == 400
    assert session.post(base_url + "/api/cart/items", headers=own_headers,
                        json={"product_id": 2, "qty": 1}, timeout=10).status_code == 201
    response = session.post(base_url + "/api/orders", headers=own_headers, timeout=60)
    assert response.status_code == 201, response.text
    order = response.json()
    assert order["status"] == "paid" and order["total"] > 0
    assert order["items"][0]["product_id"] == 2
    listing = session.get(base_url + "/api/orders", headers=own_headers, timeout=15)
    assert listing.status_code == 200
    assert order["id"] in [item["id"] for item in listing.json()]
    detail = session.get(base_url + f"/api/orders/{order['id']}", headers=own_headers, timeout=10)
    assert detail.status_code == 200 and detail.json()["items"]
    assert session.get(base_url + "/api/cart", headers=own_headers, timeout=10).json()["items"] == []


def test_foreign_order_hidden(session, base_url, own_headers, headers):
    assert session.post(base_url + "/api/cart/items", headers=own_headers,
                        json={"product_id": 3, "qty": 1}, timeout=10).status_code == 201
    created = session.post(base_url + "/api/orders", headers=own_headers, timeout=60)
    assert created.status_code == 201
    response = session.get(base_url + f"/api/orders/{created.json()['id']}", headers=headers, timeout=10)
    assert response.status_code == 404
