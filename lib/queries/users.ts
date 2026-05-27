// lib/queries/users.ts
import { queryProd } from '@/lib/db-prod'

// Type definitions tumhare schema ke basis par
export type AccountType = 'ca' | 'pe' | 'tm' | 'oa' | 'op' | 'ou' | 'cu'

export interface MainAccount {
  id: string           // id::text (BIGINT → string)
  created_at: string
  updated_at: string
  email: string
  name: string
  phone: string        // '91' strip kar dena display pe
  type: AccountType
  self_status: string  // status->'self'->>'status'
  ceind_status: string | null  // null if CEIND key absent
}

// Badge colors tumhare type codes ke liye
export const TYPE_LABELS: Record<AccountType, { label: string; color: string }> = {
  ca: { label: 'Company Admin',      color: 'gray'   },
  pe: { label: 'Principle Entity',   color: 'purple' },
  tm: { label: 'Telemarketer',       color: 'blue'   },
  oa: { label: 'Origination Access', color: 'teal'   },
  op: { label: 'Operator',           color: 'red'    },
  ou: { label: 'OU User',            color: 'green'  },
  cu: { label: 'Customer User',      color: 'amber'  },
}

// Phone number format karo — '91' strip karo 12-digit se
export function formatPhone(phone: string): string {
  if (phone && phone.length === 12 && phone.startsWith('91')) {
    return phone.substring(2)  // '919876543210' → '9876543210'
  }
  return phone
}

// Users list fetch karo — pagination ke saath
export async function getUsers(page = 1, limit = 50, search = '') {
  const offset = (page - 1) * limit

  const searchClause = search
    ? `AND (ma.email ILIKE $3 OR ma.name ILIKE $3 OR ma.phone ILIKE $3)`
    : ''
  const params = search
    ? [limit, offset, `%${search}%`]
    : [limit, offset]

  const result = await queryProd(`
    SELECT
      ma.id::text,
      ma.created_at,
      ma.updated_at,
      ma.email,
      ma.name,
      ma.phone,
      ma.type,
      ma.status->'self'->>'status'          AS self_status,
      ma.status->'CEIND'->>'approval'       AS ceind_status
    FROM main_account ma
    WHERE ma.is_deleted = '{}'              -- sirf active accounts
    ${searchClause}
    ORDER BY ma.created_at DESC
    LIMIT $1 OFFSET $2
  `, params)

  return result.rows as MainAccount[]
}

// Count for pagination
export async function getUserCount(search = '') {
  const searchClause = search
    ? `AND (email ILIKE $1 OR name ILIKE $1 OR phone ILIKE $1)`
    : ''
  const params = search ? [`%${search}%`] : []

  const result = await queryProd(`
    SELECT COUNT(*)::int as count
    FROM main_account
    WHERE is_deleted = '{}'
    ${searchClause}
  `, params)

  return result.rows[0].count as number
}

// Single user + uske saath related DLT headers aur templates
export async function getUserWithDetails(id: string) {
  // Main account
  const userResult = await queryProd(`
    SELECT
      id::text,
      email, name, phone, type,
      status->'self'->>'status'       AS self_status,
      status->'CEIND'->>'approval'    AS ceind_status,
      created_at, updated_at
    FROM main_account
    WHERE id = $1::bigint
      AND is_deleted = '{}'
  `, [id])

  if (!userResult.rows[0]) return null

  // Related DLT Headers
  const headersResult = await queryProd(`
    SELECT id::text, title, created_at, updated_at,
           status->'self'->>'status' AS self_status
    FROM dlt_header
    WHERE owner_id = $1::bigint
      AND is_deleted = '{}'
    ORDER BY created_at DESC
    LIMIT 20
  `, [id])

  // Related DLT Templates
  const templatesResult = await queryProd(`
    SELECT id::text, title, content, created_at, updated_at,
           status->'self'->>'status' AS self_status
    FROM dlt_template
    WHERE owner_id = $1::bigint
      AND is_deleted = '{}'
    ORDER BY created_at DESC
    LIMIT 20
  `, [id])

  return {
    user: userResult.rows[0],
    dlt_headers: headersResult.rows,
    dlt_templates: templatesResult.rows,
  }
}