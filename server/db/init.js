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
    DROP TABLE IF EXISTS invoice_items CASCADE;
    DROP TABLE IF EXISTS invoices CASCADE;
    DROP TABLE IF EXISTS rate_entries CASCADE;
    DROP TABLE IF EXISTS rate_cards CASCADE;
    DROP TABLE IF EXISTS postcode_zones CASCADE;
    DROP TABLE IF EXISTS customer_rate_card_assignments CASCADE;
    DROP TABLE IF EXISTS assignments CASCADE;
    DROP TABLE IF EXISTS order_surcharges CASCADE;
    DROP TABLE IF EXISTS runs CASCADE;
    DROP TABLE IF EXISTS orders CASCADE;
    DROP TABLE IF EXISTS trailers CASCADE;
    DROP TABLE IF EXISTS trucks CASCADE;
    DROP TABLE IF EXISTS drivers CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS surcharge_types CASCADE;
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
  const addCustomersTrigger = `
    DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
    CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
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
      is_active BOOLEAN DEFAULT FALSE, -- is_active będzie teraz zależeć od statusu
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
      loading_date_time DATE,
      unloading_date_time DATE,
      unloading_start_time TIME,
      unloading_end_time TIME,
      selected_surcharges TEXT[], -- Przechowuje kody wybranych dopłat, np. {'bd', 'tlc'}
      notes TEXT, -- Brakująca kolumna na notatki
      calculated_price NUMERIC(10, 2),
      final_price NUMERIC(10, 2),
      invoice_id INT REFERENCES invoices(id) ON DELETE SET NULL, -- Nowe pole do śledzenia faktury
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

  // Tabela łącząca zlecenia z dopłatami
  const createOrderSurchargesTable = `
    CREATE TABLE IF NOT EXISTS order_surcharges (
      id SERIAL PRIMARY KEY,
      order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      surcharge_type_id INT NOT NULL REFERENCES surcharge_types(id) ON DELETE RESTRICT,
      calculated_amount NUMERIC(10, 2) NOT NULL,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  // Dla tej tabeli nie dodajemy triggera 'updated_at', ponieważ wpisy są zazwyczaj niezmienne.
  // W razie potrzeby można go dodać w przyszłości.


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
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (customer_id) -- Jeden klient może mieć tylko jeden cennik
    );
  `;
  const addCustomerRateCardAssignmentsTrigger = `
    DROP TRIGGER IF EXISTS update_customer_rate_card_assignments_updated_at ON customer_rate_card_assignments;
    CREATE TRIGGER update_customer_rate_card_assignments_updated_at BEFORE UPDATE ON customer_rate_card_assignments 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
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
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(rate_card_id, rate_type, zone_id, service_level)
    );
  `;
  const addRateEntriesTrigger = `
    DROP TRIGGER IF EXISTS update_rate_entries_updated_at ON rate_entries;
    CREATE TRIGGER update_rate_entries_updated_at BEFORE UPDATE ON rate_entries 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  `;

  // Tabele finansowe
  const createSurchargeTypesTable = `
    CREATE TABLE IF NOT EXISTS surcharge_types (
      id SERIAL PRIMARY KEY,
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      calculation_method VARCHAR(20) NOT NULL CHECK (calculation_method IN ('per_order', 'per_pallet_space')),
      amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
      is_automatic BOOLEAN DEFAULT FALSE,
      requires_time BOOLEAN DEFAULT FALSE NOT NULL,
      start_time TIME NULL, -- Domyślny czas rozpoczęcia dla dopłaty czasowej
      end_time TIME NULL,   -- Domyślny czas zakończenia dla dopłaty czasowej
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Tabele do fakturowania
  const createInvoicesTable = `
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      invoice_number VARCHAR(50) UNIQUE NOT NULL,
      customer_id INT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
      issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
      due_date DATE NOT NULL,
      total_amount NUMERIC(10, 2) NOT NULL,
      status VARCHAR(50) DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'overdue', 'cancelled')),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT FALSE
    );
  `;
  const addInvoicesTrigger = `
    DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
    CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  `;

  const createInvoiceItemsTable = `
    CREATE TABLE IF NOT EXISTS invoice_items (
      id SERIAL PRIMARY KEY,
      invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      order_id INT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
      description TEXT,
      amount NUMERIC(10, 2) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(invoice_id, order_id) -- Jedno zlecenie może być tylko na jednej fakturze
    );
  `;

  try {
    await db.query(createCustomersTable);
    await db.query(addCustomersTrigger);
    console.log('✅ Tabela "customers" została utworzona.');

    // Poprawka: Tworzymy tabelę `invoices` PRZED tabelą `orders`,
    // ponieważ `orders` ma klucz obcy do `invoices`.
    await db.query(createInvoicesTable);
    await db.query(addInvoicesTrigger);
    console.log('✅ Tabela "invoices" została utworzona.');
    
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
    // Nie ma triggera, więc nie ma drugiego wywołania
    console.log('✅ Tabela "order_surcharges" została utworzona.');

    await db.query(createPostcodeZonesTable);
    await db.query(addPostcodeZonesTrigger);
    console.log('✅ Tabela "postcode_zones" została utworzona.');

    await db.query(createRateCardsTable);
    await db.query(addRateCardsTrigger);
    console.log('✅ Tabela "rate_cards" została utworzona.');

    await db.query(createCustomerRateCardAssignmentsTable);
    await db.query(addCustomerRateCardAssignmentsTrigger);
    console.log('✅ Tabela "customer_rate_card_assignments" została utworzona.');

    await db.query(createRateEntriesTable);
    await db.query(addRateEntriesTrigger);
    console.log('✅ Tabela "rate_entries" została utworzona.');

    await db.query(createInvoiceItemsTable);
    console.log('✅ Tabela "invoice_items" została utworzona.');

    // Dodajemy indeksy dla kluczowych kolumn w celu optymalizacji zapytań
    // Adding indexes for key columns to optimize queries
    const addIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_rate_entries_lookup ON rate_entries(rate_card_id, rate_type, zone_id, service_level);
      CREATE INDEX IF NOT EXISTS idx_customer_assignments_customer ON customer_rate_card_assignments(customer_id);
      CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
    `;
    await db.query(addIndexesSQL);
    console.log('✅ Indeksy dla kluczowych tabel zostały utworzone.');


    console.log('🎉 Wszystkie tabele zostały pomyślnie utworzone/zaktualizowane.');
  } catch (error) {
    console.error('❌ Błąd podczas tworzenia tabel:', error);
    throw error;
  }
};

const seedUsers = async () => {
  console.log('🌱 Seeding test users...');

  // Pobieramy domyślne hasło ze zmiennych środowiskowych. Jeśli nie jest ustawione, używamy bezpiecznego, losowego hasła.
  // This is much more secure than hardcoding 'password123'.
  const defaultPassword = process.env.DEFAULT_USER_PASSWORD || 'defaultSecurePassword123!';
  if (defaultPassword === 'defaultSecurePassword123!') {
    console.warn('   ⚠️  WARNING: DEFAULT_USER_PASSWORD is not set in .env file. Using a default password. It is recommended to set it.');
  }

  const testUsers = [
    { email: 'admin@test.com', role: 'admin', first_name: 'Admin', last_name: 'User' },
    { email: 'dispatcher@test.com', role: 'dispatcher', first_name: 'Dispatcher', last_name: 'Test' },
    { email: 'user@test.com', role: 'user', first_name: 'Customer', last_name: 'Test' },
  ];

  const insertSql = `
    INSERT INTO users (email, password_hash, role, first_name, last_name)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (email) DO NOTHING;
  `;

  let createdCount = 0;
  for (const user of testUsers) {
    const { rows: existingUsers } = await db.query('SELECT id FROM users WHERE email = $1', [user.email]);
    if (existingUsers.length === 0) {
      const password_hash = await bcrypt.hash(defaultPassword, 10);
      await db.query(insertSql, [user.email, password_hash, user.role, user.first_name, user.last_name]);
      console.log(`   ✅ Created user: ${user.email} (Role: ${user.role})`);
      createdCount++;
    } else {
      console.log(`   ℹ️ User ${user.email} already exists. Skipping.`);
    }
  }

  if (createdCount > 0) {
    console.log(`✅ Finished seeding ${createdCount} new users.`);
    console.log(`   Default password for all new users is: ${defaultPassword}`);
  }
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

const seedSurchargeTypes = async () => {
  console.log('🌱 Seeding default surcharge types...');
  try {
    const surcharges = [
      { code: 'BD', name: 'Booking-in Delivery', description: 'Surcharge for deliveries requiring a specific booking time.', calculation_method: 'per_order', amount: 20.00, is_automatic: false, requires_time: true, start_time: null, end_time: null },
      { code: 'RE', name: 'Redelivery', description: 'Surcharge for re-delivering goods.', calculation_method: 'per_pallet_space', amount: 30.00, is_automatic: false, requires_time: false, start_time: null, end_time: null },
      { code: 'SAT', name: 'Saturday Delivery', description: 'Surcharge for Saturday deliveries.', calculation_method: 'per_order', amount: 40.00, is_automatic: true, requires_time: false, start_time: null, end_time: null },
      { code: 'PT', name: 'Pre 10:00 Delivery', description: 'Delivery required between 09:00 and 10:00.', calculation_method: 'per_order', amount: 25.00, is_automatic: false, requires_time: true, start_time: '09:00', end_time: '10:00' },
      { code: 'AM', name: 'Pre 12:00 Delivery', description: 'Delivery required between 09:00 and 12:00.', calculation_method: 'per_order', amount: 10.00, is_automatic: false, requires_time: true, start_time: '09:00', end_time: '12:00' },      
      { code: 'BW', name: '4-Hour Window', description: 'Delivery within a specified 4-hour window.', calculation_method: 'per_order', amount: 7.50, is_automatic: false, requires_time: true, start_time: '11:00', end_time: '17:00' },
      { code: 'VU', name: 'Very Urgent', description: 'Surcharge for deliveries within a specific 1-hour time window.', calculation_method: 'per_order', amount: 30.00, is_automatic: false, requires_time: true, start_time: '09:00', end_time: '09:59' },
      { code: 'TL', name: 'Tail Lift', description: 'Service requires a tail-lift vehicle (no extra charge).', calculation_method: 'per_order', amount: 0.00, is_automatic: false, requires_time: false, start_time: null, end_time: null },
      { code: 'AZ', name: 'Amazon Delivery', description: 'Identifies an order for an Amazon Fulfillment Center.', calculation_method: 'per_order', amount: 0.00, is_automatic: false, requires_time: false, start_time: null, end_time: null },
      { code: 'BK', name: 'Booking', description: 'General booking surcharge.', calculation_method: 'per_order', amount: 0.00, is_automatic: false, requires_time: true, start_time: null, end_time: null },
    ];

    const sql = `
      INSERT INTO surcharge_types (code, name, description, calculation_method, amount, is_automatic, requires_time, start_time, end_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (code) DO NOTHING;
    `;

    for (const s of surcharges) {
      await db.query(sql, [s.code, s.name, s.description, s.calculation_method, s.amount, s.is_automatic, s.requires_time, s.start_time, s.end_time]);
    }
    console.log('✅ Default surcharge types have been seeded.');
  } catch (error) {
    console.error('❌ Error seeding surcharge types:', error);
    // Nie rzucamy błędu dalej, aby nie przerwać całego procesu inicjalizacji
  }
};

const initializeDatabase = async () => {
  try {
    await dropAllTables(); // Najpierw czyścimy bazę
    await setupDatabaseExtensions();
    await createTables();
    await seedUsers();
    await seedInitialData();
    await seedSurchargeTypes(); // Dodajemy wywołanie nowej funkcji
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