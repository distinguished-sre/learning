import http from 'k6/http';
import { check, sleep } from 'k6';

const baseURL = (__ENV.BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
// Модульная переменная принадлежит одному VU: вход выполняется один раз до истечения сессии.
let token;
let tokenExpiresAt = 0;

export const options = {
  scenarios: {
    shop: {
      executor: 'constant-arrival-rate',
      // 20 итераций в секунду это стресс, а не нагрузка: в каждой итерации есть заказ, а заказы
      // упираются в пул соединений (DB_POOL_MAX=5, оплата внутри транзакции), около 5 в секунду.
      // В уроках берут RATE=5, в CI RATE=2.
      rate: Number(__ENV.RATE || 20),
      timeUnit: '1s',
      duration: __ENV.DURATION || '2m',
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    checks: ['rate>0.99'],
    // Пропущенные итерации значат, что k6 дал меньше нагрузки, чем заказано: тест нельзя считать пройденным.
    dropped_iterations: ['count==0'],
  },
};

export default function () {
  if (!token || Date.now() >= tokenExpiresAt) {
    const number = ((__VU - 1) % 1000) + 1;
    const login = http.post(`${baseURL}/api/login`, JSON.stringify({
      email: `user${String(number).padStart(4, '0')}@shop.lab`, password: 'password',
    }), { headers: { 'Content-Type': 'application/json' } });
    if (!check(login, { 'вход: 200': (r) => r.status === 200 })) return;
    token = login.json('token');
    tokenExpiresAt = Date.now() + (login.json('expires_in') - 5) * 1000;
  }
  const params = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
  check(http.get(`${baseURL}/api/products`), { 'каталог: 200': (r) => r.status === 200 });
  // Товар выбирается равномерно из 10 000, поэтому кэш карточек почти не срабатывает (hit ratio
  // очень низкий при TTL 60 с). Для опыта с кэшем из урока 11.5 бери bn.js (80/20), а не этот файл.
  const productID = 1 + Math.floor(Math.random() * 10000);
  check(http.get(`${baseURL}/api/products/${productID}`, { tags: { name: '/api/products/[id]' } }),
    { 'карточка: 200': (r) => r.status === 200 });
  check(http.post(`${baseURL}/api/cart/items`, JSON.stringify({ product_id: productID, qty: 1 }), params),
    { 'корзина: 201': (r) => r.status === 201 });
  check(http.post(`${baseURL}/api/orders`, null, params), { 'заказ: 201': (r) => r.status === 201 });
  check(http.get(`${baseURL}/api/orders`, params), { 'мои заказы: 200': (r) => r.status === 200 });
  // Пауза моделирует чтение страницы; частоту новых итераций задаёт arrival-rate.
  sleep(0.2);
}
