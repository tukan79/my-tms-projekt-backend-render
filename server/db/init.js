// Plik server/db/init.js - Skrypt do inicjalizacji bazy danych
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./index');

// Ładujemy zmienne środowiskowe z pliku .env w katalogu server
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const dropAllTables = async () => {
  console.log('🧹 Czyszczenie istniejących tabel i obiektów zależnych...');
  // Usuwamy wszystkie tabele. Użycie CASCADE usunie również triggery i inne zależności.
  const dropTablesSQL = `
    DROP TABLE IF EXISTS rate_entries CASCADE;
    DROP TABLE IF EXISTS rate_cards CASCADE;
    DROP TABLE IF EXISTS postcode_zones CASCADE;
    DROP TABLE IF EXISTS customer_rate_card_assignments CASCADE;
    DROP TABLE IF EXISTS surcharge_types CASCADE;
    DROP TABLE IF EXISTS assignments CASCADE;
    DROP TABLE IF EXISTS runs CASCADE;
    DROP TABLE IF EXISTS orders CASCADE;
    DROP TABLE IF EXISTS trailers CASCADE;
    DROP TABLE IF EXISTS trucks CASCADE;
    DROP TABLE IF EXISTS drivers CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS customers CASCADE;
  `;
  await db.query(dropTablesSQL);
  console.log('✅ Wszystkie istniejące tabele zostały usunięte.');
};

const setupDatabaseExtensions = async () => {
  console.log('🔧 Konfiguruję rozszerzenia i funkcje bazy danych...');

  // Najpierw usuwamy funkcję, jeśli istnieje, aby uniknąć problemów z właścicielem.
  const dropFunctionSQL = `DROP FUNCTION IF EXISTS update_updated_at_column();`;

  // Następnie tworzymy ją na nowo.
  const createFunctionSQL = `
    CREATE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
       NEW.updated_at = NOW(); 
       RETURN NEW;
    END;
    $$ language 'plpgsql';
  `;
  
  await db.query(dropFunctionSQL);
  await db.query(createFunctionSQL);
  console.log('✅ Funkcja `update_updated_at_column` została skonfigurowana.');
};

const createTables = async () => {
  console.log('🚀 Rozpoczynam tworzenie tabel...');

  // Tabela dla klientów (customers)
  const createCustomersTable = `
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      customer_code VARCHAR(50) UNIQUE,
      name VARCHAR(255) NOT NULL UNIQUE,
      address_line1 TEXT,
      address_line2 TEXT,
      address_line3 TEXT,
      address_line4 TEXT,
      postcode VARCHAR(20),
      phone_number VARCHAR(50),
      country_code VARCHAR(10),
      category VARCHAR(100),
      currency VARCHAR(10),
      pod_on_portal BOOLEAN DEFAULT FALSE,
      invoice_on_portal BOOLEAN DEFAULT FALSE,
      handheld_status_on_portal BOOLEAN DEFAULT FALSE,
      eta_status_on_portal BOOLEAN DEFAULT FALSE,
      general_status_on_portal BOOLEAN DEFAULT FALSE,
      status VARCHAR(50) DEFAULT 'active',
      vat_number VARCHAR(50),
      payment_terms INT DEFAULT 14, -- np. 14, 30, 60 dni
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT FALSE -- Ta kolumna była brakująca
    );
  `;

  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'dispatcher', 'user')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT FALSE
    );
  `;
  const addUsersTrigger = `
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  `;

  const createDriversTable = `
    CREATE TABLE IF NOT EXISTS drivers (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      phone_number VARCHAR(50),
      license_number VARCHAR(100),
      cpc_number VARCHAR(100),
      login_code VARCHAR(50) UNIQUE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT FALSE
    );
  `;
  const addDriversTrigger = `
    DROP TRIGGER IF EXISTS update_drivers_updated_at ON drivers;
    CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  `;

  const createTrucksTable = `
    CREATE TABLE IF NOT EXISTS trucks (
      id SERIAL PRIMARY KEY,
      brand VARCHAR(100) NOT NULL,
      model VARCHAR(100) NOT NULL,
      registration_plate VARCHAR(20) UNIQUE NOT NULL,
      vin VARCHAR(17) UNIQUE,
      production_year INT,
      type_of_truck VARCHAR(50) DEFAULT 'tractor',
      total_weight INT,
      pallet_capacity INT,
      max_payload_kg INT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT FALSE
    );
  `;
  const addTrucksTrigger = `
    DROP TRIGGER IF EXISTS update_trucks_updated_at ON trucks;
    CREATE TRIGGER update_trucks_updated_at BEFORE UPDATE ON trucks 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  `;

  const createTrailersTable = `
    CREATE TABLE IF NOT EXISTS trailers (
      id SERIAL PRIMARY KEY,
      registration_plate VARCHAR(20) UNIQUE NOT NULL,
      description TEXT,
      category VARCHAR(100),
      brand VARCHAR(100),
      max_payload_kg INT,
      max_spaces INT,
      length_m NUMERIC(5, 2),
      width_m NUMERIC(5, 2),
      height_m NUMERIC(5, 2),
      weight_kg INT,
      status VARCHAR(50) DEFAULT 'inactive',
      is_active BOOLEAN DEFAULT FALSE,
      -- Deprecated columns, kept for potential data migration but can be removed later
      model VARCHAR(100), -- Deprecated
      vin VARCHAR(17) UNIQUE, -- Deprecated
      trailer_type VARCHAR(50), -- Deprecated
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT FALSE
    );
  `;
  const addTrailersTrigger = `
    DROP TRIGGER IF EXISTS update_trailers_updated_at ON trailers;
    CREATE TRIGGER update_trailers_updated_at BEFORE UPDATE ON trailers 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  `;

  const createOrdersTable = `
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
      order_number VARCHAR(255) UNIQUE,
      service_level VARCHAR(10), -- np. 'A', 'B', 'C'
      customer_reference VARCHAR(255),
      status VARCHAR(50) DEFAULT 'nowe',
      sender_details JSONB,
      recipient_details JSONB,
      cargo_details JSONB,
      loading_date_time TIMESTAMP WITH TIME ZONE,
      unloading_date_time TIMESTAMP WITH TIME ZONE,
      calculated_price NUMERIC(10, 2),
      final_price NUMERIC(10, 2),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT FALSE
    );
  `;
  const addOrdersTrigger = `
    DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
    CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  `;

  // Nowa tabela `runs` zastępuje `combinations`
  const createRunsTable = `
    CREATE TABLE IF NOT EXISTS runs (
      id SERIAL PRIMARY KEY,
      run_date DATE NOT NULL,
      type VARCHAR(50) NOT NULL CHECK (type IN ('collection', 'delivery', 'trunking')),
      truck_id INT REFERENCES trucks(id) ON DELETE RESTRICT,
      trailer_id INT REFERENCES trailers(id) ON DELETE RESTRICT,
      driver_id INT REFERENCES drivers(id) ON DELETE RESTRICT,
      status VARCHAR(50) DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT FALSE
    );
  `;
  const addRunsTrigger = `
    DROP TRIGGER IF EXISTS update_runs_updated_at ON runs;
    CREATE TRIGGER update_runs_updated_at BEFORE UPDATE ON runs 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  `;

  const createAssignmentsTable = `
    CREATE TABLE IF NOT EXISTS assignments (
      id SERIAL PRIMARY KEY,
      order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      run_id INT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT FALSE,
      UNIQUE(order_id, run_id) -- Jedno zlecenie może być przypisane do jednego przejazdu tylko raz
    );
  `;
  const addAssignmentsTrigger = `
    DROP TRIGGER IF EXISTS update_assignments_updated_at ON assignments;
    CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  `;

  // Tabele dla zaawansowanych cenników
  const createPostcodeZonesTable = `
    CREATE TABLE IF NOT EXISTS postcode_zones (
      id SERIAL PRIMARY KEY,
      zone_name VARCHAR(255) UNIQUE NOT NULL,
      postcode_patterns TEXT[], -- np. ARRAY['SW1%', 'W1%']
      is_home_zone BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  const addPostcodeZonesTrigger = `
    DROP TRIGGER IF EXISTS update_postcode_zones_updated_at ON postcode_zones;
    CREATE TRIGGER update_postcode_zones_updated_at BEFORE UPDATE ON postcode_zones 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  `;

  const createRateCardsTable = `
    CREATE TABLE IF NOT EXISTS rate_cards (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name)
    );
  `;
  const addRateCardsTrigger = `
    DROP TRIGGER IF EXISTS update_rate_cards_updated_at ON rate_cards;
    CREATE TRIGGER update_rate_cards_updated_at BEFORE UPDATE ON rate_cards 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  `;

  const createCustomerRateCardAssignmentsTable = `
    CREATE TABLE IF NOT EXISTS customer_rate_card_assignments (
      customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      rate_card_id INT NOT NULL REFERENCES rate_cards(id) ON DELETE CASCADE,
      PRIMARY KEY (customer_id, rate_card_id)
    );
  `;

  const createRateEntriesTable = `
    CREATE TABLE IF NOT EXISTS rate_entries (
      id SERIAL PRIMARY KEY,
      rate_card_id INT NOT NULL REFERENCES rate_cards(id) ON DELETE CASCADE,
      rate_type VARCHAR(50) NOT NULL CHECK (rate_type IN ('collection', 'delivery')),
      zone_id INT NOT NULL REFERENCES postcode_zones(id) ON DELETE CASCADE,
      service_level VARCHAR(10) NOT NULL, -- 'A', 'B', 'C', 'D'
      -- Nowe kolumny cenowe
      price_micro NUMERIC(10, 2),
      price_quarter NUMERIC(10, 2),
      price_half NUMERIC(10, 2),
      price_half_plus NUMERIC(10, 2),
      price_full_1 NUMERIC(10, 2),
      price_full_2 NUMERIC(10, 2),
      price_full_3 NUMERIC(10, 2),
      price_full_4 NUMERIC(10, 2),
      price_full_5 NUMERIC(10, 2),
      price_full_6 NUMERIC(10, 2),
      price_full_7 NUMERIC(10, 2),
      price_full_8 NUMERIC(10, 2),
      price_full_9 NUMERIC(10, 2),
      price_full_10 NUMERIC(10, 2),
      UNIQUE(rate_card_id, rate_type, zone_id, service_level)
    );
  `;

  // Tabele finansowe
  const createSurchargeTypesTable = `
    CREATE TABLE IF NOT EXISTS surcharge_types (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT
    );
  `;

  const createOrderSurchargesTable = `
    CREATE TABLE IF NOT EXISTS order_surcharges (
      id SERIAL PRIMARY KEY,
      order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      surcharge_type_id INT NOT NULL REFERENCES surcharge_types(id) ON DELETE RESTRICT,
      amount NUMERIC(10, 2) NOT NULL,
      notes TEXT
    );
  `;

  try {
    await db.query(createCustomersTable);
    console.log('✅ Tabela "customers" została utworzona.');
    
    await db.query(createUsersTable);
    await db.query(addUsersTrigger);
    console.log('✅ Tabela "users" została utworzona.');

    await db.query(createDriversTable);
    await db.query(addDriversTrigger);
    console.log('✅ Tabela "drivers" została utworzona.');

    await db.query(createTrucksTable);
    await db.query(addTrucksTrigger);
    console.log('✅ Tabela "trucks" została utworzona.');

    await db.query(createTrailersTable);
    await db.query(addTrailersTrigger);
    console.log('✅ Tabela "trailers" została utworzona.');

    await db.query(createOrdersTable);
    await db.query(addOrdersTrigger);
    console.log('✅ Tabela "orders" została zaktualizowana o customer_id.');

    await db.query(createRunsTable);
    await db.query(addRunsTrigger);
    console.log('✅ Tabela "runs" została utworzona.');

    await db.query(createAssignmentsTable);
    await db.query(addAssignmentsTrigger);
    console.log('✅ Tabela "assignments" została zaktualizowana.');

    await db.query(createSurchargeTypesTable);
    console.log('✅ Tabela "surcharge_types" została utworzona.');

    await db.query(createOrderSurchargesTable);
    console.log('✅ Tabela "order_surcharges" została utworzona.');

    await db.query(createPostcodeZonesTable);
    await db.query(addPostcodeZonesTrigger);
    console.log('✅ Tabela "postcode_zones" została utworzona.');

    await db.query(createRateCardsTable);
    await db.query(addRateCardsTrigger);
    console.log('✅ Tabela "rate_cards" została utworzona.');

    await db.query(createCustomerRateCardAssignmentsTable);
    console.log('✅ Tabela "customer_rate_card_assignments" została utworzona.');

    await db.query(createRateEntriesTable);
    console.log('✅ Tabela "rate_entries" została utworzona.');


    console.log('🎉 Wszystkie tabele zostały pomyślnie utworzone/zaktualizowane.');
  } catch (error) {
    console.error('❌ Błąd podczas tworzenia tabel:', error);
    throw error;
  }
};

const seedAdminUser = async () => {
  console.log('🌱 Sprawdzam, czy istnieje użytkownik admin...');

  const adminEmail = 'admin@test.com';
  const adminPassword = 'password123';
  const { rows: users } = await db.query('SELECT id FROM users WHERE email = $1', [adminEmail]);

  if (users.length > 0) {
    console.log('ℹ️ Użytkownik admin już istnieje. Pomijam tworzenie.');
    return;
  }

  console.log('➕ Tworzę domyślnego użytkownika admin...');
  const password_hash = await bcrypt.hash(adminPassword, 10);
  const insertAdminSql = `
    INSERT INTO users (email, password_hash, role, first_name, last_name)
    VALUES ($1, $2, 'admin', 'Admin', 'User')
  `;
  await db.query(insertAdminSql, [adminEmail, password_hash]);
  console.log('✅ Domyślny użytkownik admin został utworzony.');
  console.log('   Email: admin@test.com');
  console.log('   Hasło: password123');
};

const seedInitialData = async () => {
  console.log('🌱 Sprawdzam, czy istnieją dane testowe...');

  const { rows: drivers } = await db.query('SELECT id FROM drivers LIMIT 1');
  if (drivers.length > 0) {
    console.log('ℹ️ Dane testowe już istnieją. Pomijam seeding.');
    return;
  }

  console.log('➕ Dodaję przykładowe dane testowe...');
  try {
    await db.query(`
      INSERT INTO drivers (first_name, last_name) VALUES
      ('Jan', 'Kowalski'), ('Adam', 'Nowak');
    `);
    console.log('✅ Dodano przykładowych kierowców.');

    await db.query(`
      INSERT INTO trucks (brand, model, registration_plate) VALUES
      ('Volvo', 'FH', 'GD 12345'), ('Scania', 'R450', 'GA 54321');
    `);
    console.log('✅ Dodano przykładowe pojazdy.');

    await db.query(`
      INSERT INTO trailers (brand, registration_plate) VALUES
      ('Schmitz', 'GDA 11111'), ('Krone', 'GWE 22222');
    `);
    console.log('✅ Dodano przykładowe naczepy.');

    const { rows: customers } = await db.query(`
      INSERT INTO customers (name) VALUES ('Customer A'), ('Customer B') RETURNING id;
    `);
    console.log('✅ Dodano przykładowych klientów (customers).');

    await db.query(`
      INSERT INTO orders (customer_id, customer_reference, status, sender_details, recipient_details) VALUES
      ($1, 'ORD-001', 'nowe', '{"name": "Warehouse A"}', '{"name": "Logistics B"}'),
      ($2, 'ORD-002', 'nowe', '{"name": "Supplier C"}', '{"name": "Recipient D"}');
    `, [customers[0].id, customers[1].id]);
    console.log('✅ Dodano przykładowe zlecenia.');
  } catch (error) {
    console.error('❌ Błąd podczas dodawania danych testowych:', error);
  }
};

const initializeDatabase = async () => {
  try {
    await dropAllTables(); // Najpierw czyścimy bazę
    await setupDatabaseExtensions();
    await createTables();
    await seedAdminUser();
    await seedInitialData();
    console.log('\n✨ Inicjalizacja bazy danych zakończona pomyślnie!');
  } catch (error) {
    console.error('\n🔥 Wystąpił krytyczny błąd podczas inicjalizacji bazy danych. Proces przerwany.', error);
    // Błąd jest już logowany w poszczególnych funkcjach, ale logujemy go też tutaj, aby mieć pewność, że nic nie umknie.
  } finally {
    // Zamykamy pulę połączeń, aby skrypt mógł się zakończyć
    await db.end();
  }
};

// Uruchamiamy główną funkcję
initializeDatabase();