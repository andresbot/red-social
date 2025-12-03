-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- FUNCIONES COMPARTIDAS
-- ============================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ENUMS COMPARTIDOS
-- ============================================

DO $$ BEGIN
    CREATE TYPE currency_code AS ENUM ('QZ', 'COP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE account_owner_type AS ENUM ('user', 'escrow', 'platform', 'gateway');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE entry_direction AS ENUM ('debit', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM (
        'purchase',
        'transfer_in',
        'transfer_out',
        'withdrawal',
        'payment',
        'refund',
        'deposit',
        'topup',
        'transfer'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM (
        'wallet',
        'epayco',
        'pse',
        'credit_card',
        'bank_transfer'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM (
        'pending',
        'processing',
        'approved',
        'completed',
        'failed',
        'rejected',
        'cancelled'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE contract_status AS ENUM (
        'pending',
        'paid',
        'in_progress',
        'delivered',
        'completed',
        'disputed',
        'cancelled'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- TABLA: USERS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    city VARCHAR(100) NOT NUll,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('provider', 'consumer', 'both')),
    avatar TEXT,
    bio TEXT,
    website VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: ADMIN_ROLES
-- ============================================
CREATE TABLE IF NOT EXISTS admin_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: ADMIN_USERS
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role_id UUID NOT NULL REFERENCES admin_roles(id),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: WALLETS (cache opcional de saldos)
-- ============================================
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Cache de saldos (QZ halves y COP cents). Origen de verdad es el ledger.
    balance_qz_halves INTEGER DEFAULT 0 CHECK (balance_qz_halves >= 0),
    balance_cop_cents INTEGER DEFAULT 0 CHECK (balance_cop_cents >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- ============================================
-- TABLA: SERVICES
-- ============================================
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    -- Precio en QZ halves para respetar paso 0.5 QZ
    price_qz_halves INTEGER NOT NULL CHECK (price_qz_halves > 0),
    delivery_time VARCHAR(50),
    requirements TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'paused')),
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: SERVICE_IMAGES
-- ============================================
CREATE TABLE IF NOT EXISTS service_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: RATINGS
-- ============================================
CREATE TABLE IF NOT EXISTS ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(service_id, user_id)
);

-- ============================================
-- TABLA: CONVERSATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_message_preview TEXT,
    unread_count_user1 INTEGER DEFAULT 0,
    unread_count_user2 INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (user1_id < user2_id),
    UNIQUE(user1_id, user2_id, service_id)
);

-- ============================================
-- TABLAS DEL LEDGER (doble entrada)
-- ============================================

-- Cuentas: separadas por propietario y moneda
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_type account_owner_type NOT NULL,
    owner_id UUID, -- users.id, escrow_accounts.id, etc. NULL para cuentas plataforma/gateway
    currency currency_code NOT NULL,
    name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(owner_type, owner_id, currency)
);

-- Transacciones ledger (cabecera); se puede enlazar a transactions (negocio)
CREATE TABLE IF NOT EXISTS ledger_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_ref UUID, -- transactions.id u otro
    type transaction_type NOT NULL,
    status transaction_status NOT NULL DEFAULT 'pending',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Asientos contables (inmutables)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES ledger_transactions(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    direction entry_direction NOT NULL,
    -- Monto en unidades enteras según moneda:
    -- QZ: halves (0.5 QZ = 1 half)
    -- COP: cents (1 COP = 100 cents)
    amount_units BIGINT NOT NULL CHECK (amount_units > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para consultar balances
CREATE INDEX IF NOT EXISTS idx_entries_account ON ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_entries_tx ON ledger_entries(transaction_id);

-- ============================================
-- TABLA: ESCROW_ACCOUNTS
-- ============================================
CREATE TABLE IF NOT EXISTS escrow_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    -- Monto bloqueado en QZ halves
    amount_qz_halves INTEGER NOT NULL CHECK (amount_qz_halves > 0),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'funded', 'released', 'refunded', 'disputed')),
    funded_at TIMESTAMP,
    release_date TIMESTAMP,
    released_at TIMESTAMP,
    dispute_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: TRANSACTIONS (negocio, con ePayco/PSE)
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,

    type transaction_type NOT NULL,
    payment_method payment_method NOT NULL DEFAULT 'wallet',
    status transaction_status NOT NULL DEFAULT 'pending',

    -- Monto principal en COP cents o QZ halves según método
    amount_cop_cents BIGINT,
    amount_qz_halves BIGINT,
    exchange_rate DECIMAL(10, 4), -- COP por 1 QZ, si aplica

    description TEXT,
    reference_id UUID,

    -- ePayco
    authorization_code VARCHAR(100),
    payment_reference VARCHAR(100) UNIQUE,

    error_message TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,

    expires_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    metadata JSONB DEFAULT '{}'::jsonb,
    -- Validaciones coherentes: al menos uno de los montos
    CHECK (
        (amount_cop_cents IS NOT NULL AND amount_cop_cents > 0)
        OR (amount_qz_halves IS NOT NULL AND amount_qz_halves > 0)
    )
);

-- ============================================
-- TABLA: CONTRACTS
-- ============================================
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_number VARCHAR(50) NOT NULL UNIQUE,

    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    escrow_id UUID REFERENCES escrow_accounts(id) ON DELETE SET NULL,

    status contract_status NOT NULL DEFAULT 'pending',

    title VARCHAR(255) NOT NULL,
    description TEXT,
    requirements TEXT,

    -- Precios en QZ halves
    service_price_qz_halves INTEGER NOT NULL CHECK (service_price_qz_halves > 0),
    platform_fee_qz_halves INTEGER NOT NULL DEFAULT 0 CHECK (platform_fee_qz_halves >= 0),
    total_amount_qz_halves INTEGER NOT NULL CHECK (total_amount_qz_halves > 0),

    delivery_days INTEGER NOT NULL,
    started_at TIMESTAMP,
    delivered_at TIMESTAMP,
    completed_at TIMESTAMP,
    deadline TIMESTAMP,

    delivery_files JSONB DEFAULT '[]'::jsonb,
    attachments JSONB DEFAULT '[]'::jsonb,

    revisions INTEGER NOT NULL DEFAULT 0,
    max_revisions INTEGER NOT NULL DEFAULT 2,

    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    rating_id UUID REFERENCES ratings(id) ON DELETE SET NULL,

    buyer_notes TEXT,
    seller_notes TEXT,
    admin_notes TEXT,

    cancellation_reason TEXT,
    dispute_reason TEXT,

    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: SERVICE_REQUESTS (negociación)
-- ============================================
CREATE TABLE IF NOT EXISTS service_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    -- Precios negociados en QZ halves
    proposed_price_qz_halves INTEGER CHECK (proposed_price_qz_halves > 0),
    negotiated_price_qz_halves INTEGER CHECK (negotiated_price_qz_halves > 0),
    counter_offer_details TEXT,
    deadline TIMESTAMP,
    terms_agreed BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled', 'negotiating')),
    rejection_reason TEXT,
    negotiated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'offer', 'file', 'system')),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reference_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    channel VARCHAR(20) DEFAULT 'web' CHECK (channel IN ('web','email','push')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: NOTIFICATION_PREFERENCES
-- ============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_transactions BOOLEAN DEFAULT TRUE,
    email_messages BOOLEAN DEFAULT TRUE,
    email_services BOOLEAN DEFAULT FALSE,
    email_marketing BOOLEAN DEFAULT FALSE,
    push_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- ============================================
-- TABLA: USER_SKILLS
-- ============================================
CREATE TABLE IF NOT EXISTS user_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: DISPUTES
-- ============================================
CREATE TABLE IF NOT EXISTS disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escrow_id UUID NOT NULL REFERENCES escrow_accounts(id) ON DELETE CASCADE,
    complainant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    respondent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    evidence_urls TEXT[],
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
    resolution TEXT,
    resolved_by UUID REFERENCES admin_users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: SERVICE_REPORTS
-- ============================================
CREATE TABLE IF NOT EXISTS service_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
    reviewed_by UUID REFERENCES admin_users(id),
    reviewed_at TIMESTAMP,
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: ANALYTICS
-- ============================================
CREATE TABLE IF NOT EXISTS analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABLA: USER_REPORTS
-- ============================================
CREATE TABLE IF NOT EXISTS user_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('transactions', 'earnings', 'tax', 'activity')),
    date_range_start DATE NOT NULL,
    date_range_end DATE NOT NULL,
    report_data JSONB NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    download_count INTEGER DEFAULT 0
);

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

CREATE INDEX IF NOT EXISTS idx_services_user_id ON services(user_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_services_price_halves ON services(price_qz_halves);
CREATE INDEX IF NOT EXISTS idx_services_created_at ON services(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_images_service_id ON service_images(service_id);

CREATE INDEX IF NOT EXISTS idx_escrow_service_id ON escrow_accounts(service_id);
CREATE INDEX IF NOT EXISTS idx_escrow_buyer_id ON escrow_accounts(buyer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_seller_id ON escrow_accounts(seller_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow_accounts(status);

CREATE INDEX IF NOT EXISTS idx_service_requests_service_id ON service_requests(service_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_buyer_id ON service_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_seller_id ON service_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);

CREATE INDEX IF NOT EXISTS idx_ratings_service_id ON ratings(service_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user_id ON ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rating ON ratings(rating);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_user1_id ON conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2_id ON conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_service_id ON conversations(service_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_disputes_escrow_id ON disputes(escrow_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

CREATE INDEX IF NOT EXISTS idx_service_reports_service_id ON service_reports(service_id);
CREATE INDEX IF NOT EXISTS idx_service_reports_status ON service_reports(status);

CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_action ON analytics(action);

CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_reference ON transactions(payment_reference);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method);
CREATE INDEX IF NOT EXISTS idx_transactions_expires_at ON transactions(expires_at);

CREATE INDEX IF NOT EXISTS idx_contracts_service_id ON contracts(service_id);
CREATE INDEX IF NOT EXISTS idx_contracts_buyer_id ON contracts(buyer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_seller_id ON contracts(seller_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_escrow_id ON contracts(escrow_id);
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON contracts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_buyer_status ON contracts(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_seller_status ON contracts(seller_id, status);

-- ============================================
-- VISTAS
-- ============================================

CREATE OR REPLACE VIEW user_service_stats AS
SELECT 
    u.id AS user_id,
    u.full_name,
    COUNT(s.id) AS total_services,
    AVG(r.rating) AS average_rating,
    COUNT(DISTINCT r.id) AS total_ratings
FROM users u
LEFT JOIN services s ON u.id = s.user_id
LEFT JOIN ratings r ON s.id = r.service_id
GROUP BY u.id, u.full_name;

CREATE OR REPLACE VIEW recent_user_transactions AS
SELECT 
    t.id,
    t.wallet_id,
    w.user_id,
    u.full_name AS user_name,
    t.type,
    COALESCE(t.amount_cop_cents / 100.0, t.amount_qz_halves / 2.0) AS amount_display,
    t.description,
    t.status,
    t.created_at
FROM transactions t
JOIN wallets w ON t.wallet_id = w.id
JOIN users u ON w.user_id = u.id
ORDER BY t.created_at DESC;

CREATE OR REPLACE VIEW platform_metrics AS
SELECT 
    (SELECT COUNT(*) FROM users WHERE is_active = true) AS active_users,
    (SELECT COUNT(*) FROM services WHERE status = 'active') AS active_services,
    (SELECT COUNT(*) FROM transactions WHERE status = 'completed') AS completed_transactions,
    (SELECT SUM(COALESCE(amount_cop_cents,0)) / 100.0 FROM transactions WHERE status = 'completed') AS total_volume_cop,
    (SELECT SUM(COALESCE(amount_qz_halves,0)) / 2.0 FROM transactions WHERE status = 'completed') AS total_volume_qz,
    (SELECT COUNT(*) FROM disputes WHERE status = 'open') AS open_disputes,
    (SELECT COUNT(*) FROM service_reports WHERE status = 'pending') AS pending_reports,
    (SELECT AVG(rating) FROM ratings) AS platform_rating,
    CURRENT_TIMESTAMP AS calculated_at;

-- ============================================
-- FUNCIONES ESENCIALES
-- ============================================

CREATE OR REPLACE FUNCTION create_wallet_for_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO wallets (user_id, balance_qz_halves, balance_cop_cents)
    VALUES (NEW.id, 0, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_notification_preferences_for_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_preferences (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Mensajería: actualizar conversación al nuevo mensaje
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
DECLARE
    conversation_record RECORD;
    other_user_id UUID;
BEGIN
    SELECT user1_id, user2_id INTO conversation_record 
    FROM conversations WHERE id = NEW.conversation_id;
    
    IF conversation_record.user1_id = NEW.sender_id THEN
        other_user_id := conversation_record.user2_id;
    ELSE
        other_user_id := conversation_record.user1_id;
    END IF;
    
    UPDATE conversations 
    SET 
        last_message_at = NEW.created_at,
        last_message_preview = CASE 
            WHEN LENGTH(NEW.message) > 50 THEN SUBSTRING(NEW.message FROM 1 FOR 50) || '...' 
            ELSE NEW.message 
        END,
        unread_count_user1 = CASE 
            WHEN conversation_record.user1_id = other_user_id THEN unread_count_user1 + 1 
            ELSE unread_count_user1 
        END,
        unread_count_user2 = CASE 
            WHEN conversation_record.user2_id = other_user_id THEN unread_count_user2 + 1 
            ELSE unread_count_user2 
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Negociación: timestamp cuando cambia precio negociado
CREATE OR REPLACE FUNCTION update_negotiated_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.negotiated_price_qz_halves IS DISTINCT FROM OLD.negotiated_price_qz_halves THEN
        NEW.negotiated_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ledger: verificación de doble entrada por transacción
CREATE OR REPLACE FUNCTION verify_ledger_balance()
RETURNS TRIGGER AS $$
DECLARE
    total_debits BIGINT;
    total_credits BIGINT;
BEGIN
    SELECT COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount_units END),0),
           COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_units END),0)
    INTO total_debits, total_credits
    FROM ledger_entries
    WHERE transaction_id = NEW.transaction_id;

    -- Permite insertar; la verificación estricta puede hacerse al cerrar transacción (status->approved/completed)
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ledger: actualizar cache de wallets al insertar entry (opcional)
CREATE OR REPLACE FUNCTION update_wallet_cache_on_entry()
RETURNS TRIGGER AS $$
DECLARE
    acc RECORD;
BEGIN
    SELECT * INTO acc FROM accounts WHERE id = NEW.account_id;
    IF acc.owner_type = 'user' AND acc.currency = 'QZ' THEN
        IF NEW.direction = 'credit' THEN
            UPDATE wallets SET balance_qz_halves = balance_qz_halves + NEW.amount_units, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = acc.owner_id;
        ELSE
            UPDATE wallets SET balance_qz_halves = balance_qz_halves - NEW.amount_units, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = acc.owner_id;
        END IF;
    ELSIF acc.owner_type = 'user' AND acc.currency = 'COP' THEN
        IF NEW.direction = 'credit' THEN
            UPDATE wallets SET balance_cop_cents = balance_cop_cents + NEW.amount_units, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = acc.owner_id;
        ELSE
            UPDATE wallets SET balance_cop_cents = balance_cop_cents - NEW.amount_units, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = acc.owner_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_escrow_updated_at BEFORE UPDATE ON escrow_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_requests_updated_at BEFORE UPDATE ON service_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disputes_updated_at BEFORE UPDATE ON disputes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_create_wallet
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_wallet_for_user();

CREATE TRIGGER trigger_create_notification_preferences
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_notification_preferences_for_user();

CREATE TRIGGER trigger_update_negotiated_at
BEFORE UPDATE ON service_requests
FOR EACH ROW
EXECUTE FUNCTION update_negotiated_at();

CREATE TRIGGER trigger_update_conversation
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_on_message();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at 
    BEFORE UPDATE ON contracts
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Ledger triggers
CREATE TRIGGER ledger_entry_insert_verify
AFTER INSERT ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION verify_ledger_balance();

CREATE TRIGGER ledger_entry_update_wallet_cache
AFTER INSERT ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION update_wallet_cache_on_entry();

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Roles administrativos
INSERT INTO admin_roles (role_name, description, permissions) VALUES
('superadmin', 'Acceso total al sistema', '{"all": true}'::jsonb)
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO admin_roles (role_name, description, permissions) VALUES
('moderator', 'Moderación de contenido', '{"users": true, "services": true, "disputes": true, "reports": true}'::jsonb)
ON CONFLICT (role_name) DO NOTHING;

-- Usuarios de prueba
INSERT INTO users (email, password, full_name, phone, city, user_type, bio)
VALUES (
    'demo@quetzal.com',
    crypt('Demo123', gen_salt('bf')),
    'Usuario Demo',
    '+57 300 123 4567',
    'bogota',
    'both',
    'Usuario de demostración'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password, full_name, phone, city, user_type, bio)
VALUES (
    'proveedor@quetzal.com',
    crypt('Demo123', gen_salt('bf')),
    'Proveedor Demo',
    '+57 310 234 5678',
    'medellin',
    'provider',
    'Proveedor profesional'
)
ON CONFLICT (email) DO NOTHING;

-- Crear servicios de prueba
INSERT INTO services (user_id, title, description, category, price_qz_halves, delivery_time, status)
SELECT 
    id,
    'Desarrollo de Sitio Web Profesional',
    'Creo sitios web profesionales y modernos con las últimas tecnologías',
    'desarrollo',
    31, -- 15.5 QZ = 31 halves
    '7 días',
    'active'
FROM users WHERE email = 'proveedor@quetzal.com';

-- Admin user
INSERT INTO admin_users (email, password, full_name, role_id)
VALUES (
    'admin@quetzal.com',
    crypt('Admin123', gen_salt('bf')),
    'Administrador Principal',
    (SELECT id FROM admin_roles WHERE role_name = 'superadmin')
)
ON CONFLICT (email) DO NOTHING;

-- Cuentas base de plataforma/gateway (ledger)
-- Plataforma QZ (propietario NULL)
INSERT INTO accounts (owner_type, owner_id, currency, name)
VALUES ('platform', NULL, 'QZ', 'platform_qz')
ON CONFLICT DO NOTHING;

-- Gateway COP (propietario NULL)
INSERT INTO accounts (owner_type, owner_id, currency, name)
VALUES ('gateway', NULL, 'COP', 'gateway_cop')
ON CONFLICT DO NOTHING;

-- Crear cuentas de usuario por moneda (QZ y COP) para usuarios de prueba
INSERT INTO accounts (owner_type, owner_id, currency, name)
SELECT 'user', u.id, 'QZ', 'user_wallet_qz'
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM accounts a WHERE a.owner_type='user' AND a.owner_id=u.id AND a.currency='QZ'
);

INSERT INTO accounts (owner_type, owner_id, currency, name)
SELECT 'user', u.id, 'COP', 'user_wallet_cop'
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM accounts a WHERE a.owner_type='user' AND a.owner_id=u.id AND a.currency='COP'
);

-- ============================================
-- VERIFICACIÓN FINAL
-- ============================================

-- Ver tablas creadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;

-- Estadísticas
SELECT 'Usuarios' AS tabla, COUNT(*) AS registros FROM users
UNION ALL SELECT 'Servicios', COUNT(*) FROM services
UNION ALL SELECT 'Administradores', COUNT(*) FROM admin_users
UNION ALL SELECT 'Disputas', COUNT(*) FROM disputes
UNION ALL SELECT 'Conversaciones', COUNT(*) FROM conversations;

-- Mostrar métricas
SELECT * FROM platform_metrics;

ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'rejected';









-- Migration: Add profile enhancements
-- Date: 2024-12-02
-- Description: Add privacy settings and missing triggers

-- Add bio length constraint (si no existe)
DO $$ 
BEGIN
    ALTER TABLE users ADD CONSTRAINT bio_length_check CHECK (length(bio) <= 500);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create privacy_settings table
CREATE TABLE IF NOT EXISTS privacy_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    show_email BOOLEAN DEFAULT FALSE,
    show_phone BOOLEAN DEFAULT FALSE,
    public_profile BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for privacy_settings updated_at
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_privacy_settings_updated_at'
    ) THEN
        CREATE TRIGGER update_privacy_settings_updated_at
            BEFORE UPDATE ON privacy_settings
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Create index
CREATE INDEX IF NOT EXISTS idx_privacy_settings_user_id ON privacy_settings(user_id);

-- Insert default privacy settings for existing users
INSERT INTO privacy_settings (user_id, show_email, show_phone, public_profile)
SELECT id, FALSE, FALSE, TRUE
FROM users
WHERE id NOT IN (SELECT user_id FROM privacy_settings)
ON CONFLICT (user_id) DO NOTHING;

COMMENT ON TABLE privacy_settings IS 'User privacy and visibility settings';



-- Agregar columnas de social links a users
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS github VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS twitter VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS portfolio VARCHAR(255);

-- Agregar constraint de bio length
DO $$ 
BEGIN
    ALTER TABLE users ADD CONSTRAINT bio_length_check CHECK (length(bio) <= 500);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--COMMENT ON DATABASE current_database() IS 'Estructura Quetzal Platform con ledger doble entrada y unidades enteras (QZ halves, COP cents)';





UPDATE users
SET city = 'Unknown'
WHERE city IS NULL;

ALTER TABLE users
ALTER COLUMN city SET NOT NULL;



-- Función: crear cuentas ledger para nuevos escrows
CREATE OR REPLACE FUNCTION create_escrow_ledger_accounts()
RETURNS TRIGGER AS $$
BEGIN
    -- Cuenta QZ para el escrow
    IF NOT EXISTS (
        SELECT 1 FROM accounts 
        WHERE owner_type = 'escrow' AND owner_id = NEW.id AND currency = 'QZ'
    ) THEN
        INSERT INTO accounts (owner_type, owner_id, currency, name)
        VALUES ('escrow', NEW.id, 'QZ', 'escrow_qz_' || NEW.id::text);
    END IF;

    -- Cuenta COP para el escrow (por si se usa COP en algún flujo)
    IF NOT EXISTS (
        SELECT 1 FROM accounts 
        WHERE owner_type = 'escrow' AND owner_id = NEW.id AND currency = 'COP'
    ) THEN
        INSERT INTO accounts (owner_type, owner_id, currency, name)
        VALUES ('escrow', NEW.id, 'COP', 'escrow_cop_' || NEW.id::text);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: crear cuentas al insertar en escrow_accounts
CREATE TRIGGER trigger_create_escrow_ledger_accounts
AFTER INSERT ON escrow_accounts
FOR EACH ROW
EXECUTE FUNCTION create_escrow_ledger_accounts();


ALTER TABLE contracts ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;