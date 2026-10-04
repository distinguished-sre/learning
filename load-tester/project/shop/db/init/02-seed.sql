INSERT INTO categories (name)
SELECT 'Категория ' || n FROM generate_series(1, 20) AS n;
INSERT INTO products (name, price, category_id, stock)
SELECT 'Товар ' || n, 100 + (n * 37 % 49901), 1 + (n - 1) % 20, 1000000
FROM generate_series(1, 10000) AS n;

-- MATERIALIZED гарантирует одну дорогую операцию bcrypt для всей тысячи строк.
WITH hashed AS MATERIALIZED (SELECT crypt('password', gen_salt('bf', 12)) AS password_hash)
INSERT INTO users (email, password_hash)
SELECT 'user' || lpad(n::text, 4, '0') || '@shop.lab', hashed.password_hash
FROM generate_series(1, 1000) AS n CROSS JOIN hashed;

INSERT INTO orders (user_id, status, total, created_at)
SELECT 1 + (n - 1) % 1000, 'paid', 0,
       now() - interval '1 day' - n * interval '1 second'
FROM generate_series(1, 200000) AS n;
INSERT INTO order_items (order_id, product_id, qty, price)
SELECT o.id, p.id, 1, p.price
FROM orders o
CROSS JOIN LATERAL generate_series(1, 1 + o.id % 3) AS item(n)
JOIN products p ON p.id = 1 + (o.id * 7 + item.n) % 10000;
UPDATE orders o SET total = sums.total
FROM (SELECT order_id, sum(price * qty) AS total FROM order_items GROUP BY order_id) sums
WHERE o.id = sums.order_id;
-- Статистика нужна оптимизатору сразу после первого запуска, до autovacuum.
ANALYZE;
