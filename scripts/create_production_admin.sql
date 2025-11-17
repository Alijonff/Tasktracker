-- SQL скрипт для создания админа в production database
-- Использование: выполните этот SQL в Database pane, переключившись на Production

-- Логин: admin
-- Пароль: qwerty

INSERT INTO users (username, password_hash, name, email, role, position_type, must_change_password)
VALUES ('admin', '$2b$10$NdkbzUce0TSj/gHo3xqRbORRR0DQgoxX/0Q8nwoHO3LqrYlMk3o2m', 'Администратор', 'admin@system.local', 'admin', 'employee', false)
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;
