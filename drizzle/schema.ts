// drizzle/schema.ts
// সম্পূর্ণ ডাটাবেজ স্কিমা — Drizzle ORM
import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  date,
  boolean,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

// ---- Enum ----
export const appRole = pgEnum("app_role", ["owner", "moderator", "customer"]);

// ---- Profiles ----
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull(),
  mobile: text("mobile").notNull(),
  serial: text("serial"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---- User Roles ----
export const userRoles = pgTable("user_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  role: appRole("role").notNull(),
});

// ---- Parties (কাস্টমার / সাপ্লায়ার / হাওলাত) ----
export const parties = pgTable("parties", {
  id: uuid("id").primaryKey().defaultRandom(),
  serial: text("serial").notNull(),
  shopName: text("shop_name").notNull(),
  ownerName: text("owner_name"),
  mobile: text("mobile"),
  address: text("address"),
  location: text("location"),
  kind: text("kind").notNull(), // retail | wholesale | supplier | hawlat
  userId: uuid("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---- Products (স্টক) ----
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  quantity: numeric("quantity").notNull().default("0"),
  unit: text("unit").notNull().default("পিস"),
  unitPrice: numeric("unit_price").notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---- Day Entries (খুচরা খাতা) ----
export const dayEntries = pgTable("day_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryDate: date("entry_date").notNull().defaultNow(),
  kind: text("kind").notNull(), // cash_sale | expense | deposit | credit
  name: text("name"),
  details: text("details"),
  amount: numeric("amount").notNull().default("0"),
  partyId: uuid("party_id").references(() => parties.id, {
    onDelete: "set null",
  }),
  memoId: uuid("memo_id"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---- Hawlat Entries (হাওলাত) ----
export const hawlatEntries = pgTable("hawlat_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  partyId: uuid("party_id")
    .notNull()
    .references(() => parties.id, { onDelete: "cascade" }),
  entryDate: date("entry_date").notNull().defaultNow(),
  kind: text("kind").notNull(), // give | receive
  amount: numeric("amount").notNull().default("0"),
  note: text("note"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---- Supplier Entries (দেনা খাতা) ----
export const supplierEntries = pgTable("supplier_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  partyId: uuid("party_id")
    .notNull()
    .references(() => parties.id, { onDelete: "cascade" }),
  entryDate: date("entry_date").notNull().defaultNow(),
  kind: text("kind").notNull(), // purchase | payment
  amount: numeric("amount").notNull().default("0"),
  details: text("details"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---- Memos (মেমো) ----
export const memos = pgTable("memos", {
  id: uuid("id").primaryKey().defaultRandom(),
  memoNo: integer("memo_no"),
  memoDate: date("memo_date").notNull().defaultNow(),
  partyId: uuid("party_id").references(() => parties.id, {
    onDelete: "set null",
  }),
  shopName: text("shop_name"),
  ownerName: text("owner_name"),
  mobile: text("mobile"),
  address: text("address"),
  partySerial: text("party_serial"),
  previousDue: numeric("previous_due").notNull().default("0"),
  total: numeric("total").notNull().default("0"),
  paid: numeric("paid").notNull().default("0"),
  status: text("status").notNull().default("draft"), // draft | confirmed | void
  note: text("note"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---- Memo Items (মেমোর পণ্য) ----
export const memoItems = pgTable("memo_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  memoId: uuid("memo_id")
    .notNull()
    .references(() => memos.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  name: text("name").notNull().default(""),
  quantity: numeric("quantity").notNull().default("1"),
  unit: text("unit"),
  price: numeric("price").notNull().default("0"),
  productId: uuid("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
});

// ---- OTP Codes ----
export const otpCodes = pgTable("otp_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---- Login Logs ----
export const loginLogs = pgTable("login_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  userAgent: text("user_agent"),
  loggedInAt: timestamp("logged_in_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---- Shop Settings ----
export const shopSettings = pgTable("shop_settings", {
  id: integer("id").primaryKey().default(1),
  about: text("about"),
  ownerPhotoPath: text("owner_photo_path"),
  shopPhotoPath: text("shop_photo_path"),
  gallery: jsonb("gallery").default([]),
});