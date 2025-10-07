const db = require('../db/index.js');
const bcrypt = require('bcryptjs');

const createUser = async (userData) => {
  const { email, password, role, first_name, last_name } = userData;
  const password_hash = await bcrypt.hash(password, 10);
  const sql = `
    INSERT INTO users (email, password_hash, role, first_name, last_name)
    VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role, first_name, last_name;
  `;
  const { rows } = await db.query(sql, [email, password_hash, role, first_name, last_name]);
  return rows[0];
};

const findAllUsers = async () => {
  const { rows } = await db.query('SELECT id, email, first_name, last_name, role, created_at FROM users WHERE is_deleted = FALSE ORDER BY last_name, first_name');
  return rows;
};

const findUserByEmailWithPassword = async (email) => {
  const { rows } = await db.query('SELECT * FROM users WHERE email = $1 AND is_deleted = FALSE', [email]);
  return rows[0] || null;
};

const findUserById = async (userId) => {
  const { rows } = await db.query(
    'SELECT id, email, role, first_name, last_name FROM users WHERE id = $1 AND is_deleted = FALSE',
    [userId]
  );
  return rows[0] || null;
};

const updateUser = async (userId, userData) => {
  const { role } = userData; // For now, only allow role updates
  const sql = `
    UPDATE users SET role = $1, updated_at = NOW()
    WHERE id = $2 AND is_deleted = FALSE
    RETURNING id, email, role, first_name, last_name;
  `;
  const { rows } = await db.query(sql, [role, userId]);
  return rows[0] || null;
};

const deleteUser = async (userId) => {
  const result = await db.query('UPDATE users SET is_deleted = TRUE WHERE id = $1', [userId]);
  return result.rowCount;
};

const importUsers = async (usersData) => {
  return db.withTransaction(async (client) => {
    const importedUsers = [];
    const errors = [];
    const sql = `
      INSERT INTO users (email, first_name, last_name, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        updated_at = NOW()
      RETURNING id;
    `;

    for (const [index, user] of usersData.entries()) {
      if (!user.email || !user.password || !user.role || !user.first_name || !user.last_name) {
        errors.push({ line: index + 2, message: 'Missing required fields.' });
        continue;
      }

      if (user.password.length < 6) {
        errors.push({ line: index + 2, message: `Password for ${user.email} is too short (min 6 chars).` });
        continue;
      }

      const password_hash = await bcrypt.hash(user.password, 10);

      try {
        const result = await client.query(sql, [
          user.email,
          user.first_name,
          user.last_name,
          password_hash,
          user.role,
        ]);
        if (result.rows.length > 0) {
          importedUsers.push(result.rows[0]);
        }
      } catch (e) {
        errors.push({ line: index + 2, message: `Database error for ${user.email}: ${e.message}` });
      }
    }
    return { count: importedUsers.length, importedIds: importedUsers.map(u => u.id), errors };
  });
};

module.exports = {
  createUser,
  findUserById,
  findAllUsers,
  updateUser,
  deleteUser,
  importUsers,
  findUserByEmailWithPassword,
};