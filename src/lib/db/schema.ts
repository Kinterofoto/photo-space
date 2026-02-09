import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  real,
  jsonb,
  index,
} from "drizzle-orm/pg-core"

export const photos = pgTable("photos", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  url: text("url").notNull(),
  thumbUrl: text("thumb_url").notNull(),
  width: integer("width"),
  height: integer("height"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const persons = pgTable("persons", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  faceCount: integer("face_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const faces = pgTable(
  "faces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    photoName: text("photo_name").notNull(),
    personId: uuid("person_id").references(() => persons.id),
    awsFaceId: text("aws_face_id"),
    landmarks: jsonb("landmarks").notNull().$type<{ x: number; y: number }[]>(),
    boxX: real("box_x").notNull(),
    boxY: real("box_y").notNull(),
    boxW: real("box_w").notNull(),
    boxH: real("box_h").notNull(),
    thumbnail: text("thumbnail"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("faces_photo_name_idx").on(table.photoName),
    index("faces_person_id_idx").on(table.personId),
  ]
)

export type Photo = typeof photos.$inferSelect
export type Person = typeof persons.$inferSelect
export type Face = typeof faces.$inferSelect
