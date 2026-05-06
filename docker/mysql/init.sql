-- init.sql
-- Script inicial de base de datos para U-Ride
-- Crea las tablas fundamentales requeridas e inserta datos semilla.
-- Nota: NestJS/TypeORM usará synchronize: true, pero estas tablas garantizan 
-- la creación inicial requerida para el funcionamiento.

CREATE DATABASE IF NOT EXISTS uride_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE uride_db;

-- 1. Tabla de Roles
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  image VARCHAR(255),
  route VARCHAR(255) NOT NULL,
  created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
);

-- Inserción de roles básicos
INSERT IGNORE INTO roles (id, name, image, route) VALUES
('STUDENT', 'Estudiante (Pasajero)', 'student.png', 'client/home'),
('DRIVER', 'Estudiante (Conductor)', 'driver.png', 'driver/home'),
('ADMIN', 'Administrador', 'admin.png', 'admin/home');

-- 2. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  lastname VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(255),
  password VARCHAR(255) NOT NULL,
  image VARCHAR(255),
  session_token VARCHAR(255),
  career VARCHAR(255),
  reference_zone VARCHAR(255),
  institutional_verified BOOLEAN DEFAULT FALSE,
  email_verification_code VARCHAR(255),
  is_suspended BOOLEAN DEFAULT FALSE,
  suspended_until DATETIME,
  reputation_average FLOAT DEFAULT 0,
  reputation_count INT DEFAULT 0,
  created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
);

-- Inserción manual de administrador si es requerido por script
-- Nota: Las contraseñas están encriptadas con bcrypt, así que el backend
-- SeedService se encargará de la inserción si el entorno tiene variables ADMIN_EMAIL/PASSWORD.

-- 3. Tabla intermedia User Roles
CREATE TABLE IF NOT EXISTS user_has_roles (
  id_user INT NOT NULL,
  id_rol VARCHAR(255) NOT NULL,
  PRIMARY KEY (id_user, id_rol),
  FOREIGN KEY (id_user) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (id_rol) REFERENCES roles(id) ON DELETE CASCADE
);

-- 4. Tabla de Viajes Publicados (client_requests)
CREATE TABLE IF NOT EXISTS client_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_driver INT,
  origin_zone VARCHAR(255) NOT NULL,
  destination_zone VARCHAR(255) NOT NULL,
  departure_time DATETIME NOT NULL,
  seats_total INT NOT NULL,
  seats_available INT NOT NULL,
  status VARCHAR(255) DEFAULT 'PUBLISHED',
  notes TEXT,
  confirmed_passengers INT DEFAULT 0,
  created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  FOREIGN KEY (id_driver) REFERENCES users(id) ON DELETE SET NULL
);

-- 5. Tabla de Ofertas de Viaje / Solicitudes de Unión (driver_trip_offers)
CREATE TABLE IF NOT EXISTS driver_trip_offers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_trip INT NOT NULL,
  id_passenger INT NOT NULL,
  status VARCHAR(255) DEFAULT 'PENDING',
  message TEXT,
  passenger_rating_to_driver DECIMAL(3,2),
  driver_rating_to_passenger DECIMAL(3,2),
  passenger_review_to_driver TEXT,
  driver_review_to_passenger TEXT,
  created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  FOREIGN KEY (id_trip) REFERENCES client_requests(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (id_passenger) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Tabla de Reportes
CREATE TABLE IF NOT EXISTS reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reporter_user_id INT NOT NULL,
  reported_user_id INT NOT NULL,
  reason TEXT NOT NULL,
  evidence_url VARCHAR(255),
  status VARCHAR(255) DEFAULT 'OPEN',
  admin_notes TEXT,
  created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. Tabla de Auditoría
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  details TEXT,
  created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
);

-- =====================================================================================
-- INSERCIÓN DE DATOS DE PRUEBA (TEST DATA)
-- =====================================================================================

-- Nota: Todas las contraseñas de los usuarios de prueba son "password123"
-- El hash corresponde a bcrypt salt=10

-- Insertar Usuarios de Prueba
INSERT IGNORE INTO users (id, name, lastname, email, password, career, reference_zone, institutional_verified, reputation_average, reputation_count) VALUES
(101, 'Juan', 'Perez', 'juan.perez@universidad.edu.co', '$2b$10$hrnZQNwwD5bb.pXYRTI0remVQL3W1PBClS49gFq/pfwO/sCxrA4qK', 'Ingeniería', 'Zona Norte', true, 4.5, 2),
(102, 'Maria', 'Gomez', 'maria.gomez@universidad.edu.co', '$2b$10$hrnZQNwwD5bb.pXYRTI0remVQL3W1PBClS49gFq/pfwO/sCxrA4qK', 'Derecho', 'Zona Sur', true, 5.0, 1),
(103, 'Carlos', 'Driver', 'carlos.driver@universidad.edu.co', '$2b$10$hrnZQNwwD5bb.pXYRTI0remVQL3W1PBClS49gFq/pfwO/sCxrA4qK', 'Medicina', 'Centro', true, 4.8, 15),
(104, 'Laura', 'Cond', 'laura.cond@universidad.edu.co', '$2b$10$hrnZQNwwD5bb.pXYRTI0remVQL3W1PBClS49gFq/pfwO/sCxrA4qK', 'Arquitectura', 'Zona Este', true, 4.2, 8);

-- Asignar Roles a Usuarios de Prueba
INSERT IGNORE INTO user_has_roles (id_user, id_rol) VALUES
(101, 'STUDENT'),
(102, 'STUDENT'),
(103, 'DRIVER'),
(104, 'DRIVER');

-- Insertar Viajes de Prueba (Publicados por conductores)
INSERT IGNORE INTO client_requests (id, id_driver, origin_zone, destination_zone, departure_time, seats_total, seats_available, status, notes, confirmed_passengers) VALUES
(1, 103, 'Campus Principal', 'Barrio Centro', DATE_ADD(NOW(), INTERVAL 1 DAY), 4, 3, 'PUBLISHED', 'Saldré puntual. No comer en el auto.', 1),
(2, 104, 'Campus Norte', 'Barrio Sur', DATE_ADD(NOW(), INTERVAL 2 DAY), 3, 3, 'PUBLISHED', 'Llevo música relajante.', 0),
(3, 103, 'Barrio Centro', 'Campus Principal', DATE_SUB(NOW(), INTERVAL 1 DAY), 4, 2, 'FINISHED', 'Viaje completado exitosamente.', 2);

-- Insertar Solicitudes para Unirse (Pasajeros aplicando a los viajes)
INSERT IGNORE INTO driver_trip_offers (id, id_trip, id_passenger, status, message) VALUES
(1, 1, 101, 'ACCEPTED', 'Hola Carlos, me sirve tu ruta para llegar a casa.'),
(2, 2, 102, 'PENDING', 'Hola Laura, ¿pasas por la avenida principal?'),
(3, 3, 101, 'ACCEPTED', 'Te acompaño al campus.');

-- Insertar Reportes de Prueba (Simulando moderación)
INSERT IGNORE INTO reports (id, reporter_user_id, reported_user_id, reason, status) VALUES
(1, 101, 104, 'La conductora canceló el viaje en el último minuto sin justificación.', 'OPEN'),
(2, 103, 102, 'La pasajera ensució el asiento con café y no quiso limpiar.', 'REVIEWED');

-- Insertar Logs de Auditoría
INSERT IGNORE INTO audit_logs (id, actor_user_id, event_type, details) VALUES
(1, 103, 'TRIP_PUBLISHED', 'Viaje ID 1 publicado exitosamente'),
(2, 101, 'JOIN_REQUEST_CREATED', 'Solicitud de unión creada para el Viaje ID 1'),
(3, 103, 'JOIN_REQUEST_DECIDED', 'Solicitud ID 1 aceptada'),
(4, 101, 'REPORT_CREATED', 'Reporte creado contra el usuario ID 104');

