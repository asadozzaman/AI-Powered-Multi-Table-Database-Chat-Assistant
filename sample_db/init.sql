CREATE TABLE cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    region VARCHAR(120) NOT NULL,
    country VARCHAR(120) NOT NULL
);

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    city_id INTEGER NOT NULL REFERENCES cities(id),
    full_name VARCHAR(160) NOT NULL,
    email VARCHAR(180) UNIQUE NOT NULL,
    segment VARCHAR(50) NOT NULL,
    created_at DATE NOT NULL
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    sku VARCHAR(60) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    order_date DATE NOT NULL,
    status VARCHAR(40) NOT NULL,
    channel VARCHAR(40) NOT NULL
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL
);

CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    paid_at DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    method VARCHAR(40) NOT NULL,
    status VARCHAR(40) NOT NULL
);

CREATE INDEX idx_customers_city_id ON customers(city_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);

INSERT INTO cities (name, region, country) VALUES
('New York', 'Northeast', 'USA'),
('Austin', 'South', 'USA'),
('Seattle', 'West', 'USA'),
('Chicago', 'Midwest', 'USA'),
('Dhaka', 'Dhaka', 'Bangladesh');

INSERT INTO categories (name) VALUES
('Electronics'),
('Office Supplies'),
('Furniture'),
('Software');

INSERT INTO customers (city_id, full_name, email, segment, created_at) VALUES
(1, 'Avery Stone', 'avery@example.com', 'Enterprise', '2024-01-12'),
(2, 'Maya Patel', 'maya@example.com', 'SMB', '2024-02-04'),
(3, 'Noah Kim', 'noah@example.com', 'Consumer', '2024-03-18'),
(4, 'Sophia Garcia', 'sophia@example.com', 'Enterprise', '2024-04-02'),
(5, 'Rafi Ahmed', 'rafi@example.com', 'SMB', '2024-05-10');

INSERT INTO products (category_id, sku, name, unit_price, active) VALUES
(1, 'EL-LAP-14', '14 inch business laptop', 1299.00, TRUE),
(1, 'EL-MON-27', '27 inch monitor', 329.00, TRUE),
(2, 'OS-CHAIR-MAT', 'Desk chair mat', 49.00, TRUE),
(3, 'FU-STAND-DESK', 'Standing desk', 599.00, TRUE),
(4, 'SW-CRM-ANNUAL', 'CRM annual license', 899.00, TRUE);

INSERT INTO orders (customer_id, order_date, status, channel) VALUES
(1, '2025-01-15', 'completed', 'sales'),
(2, '2025-02-03', 'completed', 'web'),
(3, '2025-02-11', 'completed', 'web'),
(4, '2025-03-09', 'completed', 'partner'),
(5, '2025-03-21', 'refunded', 'web'),
(1, '2025-04-05', 'completed', 'sales');

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
(1, 1, 5, 1249.00),
(1, 5, 5, 849.00),
(2, 2, 3, 329.00),
(2, 3, 6, 45.00),
(3, 2, 1, 329.00),
(4, 4, 8, 579.00),
(4, 5, 8, 899.00),
(5, 1, 1, 1299.00),
(6, 5, 3, 879.00);

INSERT INTO payments (order_id, paid_at, amount, method, status) VALUES
(1, '2025-01-17', 10490.00, 'wire', 'paid'),
(2, '2025-02-03', 1257.00, 'card', 'paid'),
(3, '2025-02-11', 329.00, 'card', 'paid'),
(4, '2025-03-10', 11824.00, 'wire', 'paid'),
(5, '2025-03-22', 1299.00, 'card', 'refunded'),
(6, '2025-04-06', 2637.00, 'wire', 'paid');
