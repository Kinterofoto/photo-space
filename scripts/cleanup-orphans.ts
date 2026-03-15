import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  // 1. Fix stale face_count on all persons
  console.log("Syncing face_count on all persons...")
  const stale = await sql`
    UPDATE persons
    SET face_count = (SELECT COUNT(*) FROM faces WHERE faces.person_id = persons.id)
    WHERE face_count != (SELECT COUNT(*) FROM faces WHERE faces.person_id = persons.id)
    RETURNING id, name, face_count
  `
  if (stale.length > 0) {
    console.log(`  Fixed ${stale.length} stale count(s):`)
    for (const p of stale) {
      console.log(`    ${p.name || "(unnamed)"} → ${p.face_count}`)
    }
  } else {
    console.log("  All counts already correct.")
  }

  // 2. Delete orphan persons (face_count = 0 and no faces reference them)
  console.log("\nDeleting orphan persons...")
  const orphans = await sql`
    DELETE FROM persons
    WHERE id NOT IN (SELECT DISTINCT person_id FROM faces WHERE person_id IS NOT NULL)
    RETURNING id, name
  `
  if (orphans.length > 0) {
    console.log(`  Deleted ${orphans.length} orphan(s):`)
    for (const p of orphans) {
      console.log(`    ${p.name || "(unnamed)"} [${p.id.slice(0, 8)}]`)
    }
  } else {
    console.log("  No orphans found.")
  }

  // 3. Report faces with dangling photo references
  const danglingFaces = await sql`
    SELECT f.id, f.photo_name FROM faces f
    LEFT JOIN photos p ON p.name = f.photo_name
    WHERE p.id IS NULL
  `
  if (danglingFaces.length > 0) {
    console.log(`\nWarning: ${danglingFaces.length} face(s) reference non-existent photos:`)
    for (const f of danglingFaces.slice(0, 10)) {
      console.log(`    face ${f.id.slice(0, 8)} → photo "${f.photo_name}"`)
    }
    if (danglingFaces.length > 10) console.log(`    ... and ${danglingFaces.length - 10} more`)
  }

  // Summary
  const total = await sql`SELECT COUNT(*) as count FROM persons`
  console.log(`\nDone. ${total[0].count} person(s) remaining.`)
}

main().catch(console.error)
