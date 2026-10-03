import random

from locust import HttpUser, between, task
from locust.exception import StopUser


class ShopUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        number = random.randint(1, 1000)
        with self.client.post("/api/login", json={"email": f"user{number:04d}@shop.lab", "password": "password"},
                              catch_response=True, timeout=60) as response:
            if response.status_code != 200:
                response.failure("Не удалось войти")
                raise StopUser()
            try:
                token = response.json()["token"]
            except (ValueError, KeyError):
                response.failure("Нет токена в ответе")
                raise StopUser()
            self.client.headers.update({"Authorization": "Bearer " + token})

    def expect(self, response, status):
        # Явная проверка статуса замечает ошибки даже в формально успешном HTTP-ответе.
        if response.status_code != status:
            response.failure(f"Ожидался {status}, получен {response.status_code}")

    @task(6)
    def catalog(self):
        with self.client.get("/api/products", params={"page": random.randint(1, 10)},
                             catch_response=True, timeout=30) as response:
            self.expect(response, 200)

    @task(3)
    def product(self):
        # name группирует разные ID в одну строку статистики Locust.
        with self.client.get(f"/api/products/{random.randint(1, 10000)}", name="/api/products/[id]",
                             catch_response=True, timeout=30) as response:
            self.expect(response, 200)

    @task(2)
    def add_to_cart(self):
        with self.client.post("/api/cart/items", json={"product_id": random.randint(1, 10000), "qty": 1},
                              catch_response=True, timeout=30) as response:
            self.expect(response, 201)

    @task(1)
    def checkout(self):
        with self.client.post("/api/orders", catch_response=True, timeout=60) as response:
            # Случайный пользователь может ещё не добавлять товары; пустая корзина — штатный отказ.
            if response.status_code == 400 and response.json().get("detail") == "cart is empty":
                response.success()
            else:
                self.expect(response, 201)

    @task(1)
    def orders(self):
        with self.client.get("/api/orders", catch_response=True, timeout=30) as response:
            self.expect(response, 200)
