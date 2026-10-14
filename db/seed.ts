import "./load-env";

import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { env } from "@/lib/env";

if (env.NODE_ENV === "production") {
  throw new Error("O seed é apenas para desenvolvimento.");
}

const admin = {
  name: "Admin",
  email: "admin@gulosos.ai",
  password: "admin12345",
};

async function main() {
  await db
    .insert(users)
    .values({ name: admin.name, email: admin.email, passwordHash: await hashPassword(admin.password) })
    .onConflictDoNothing({ target: users.email });

  console.log(`Seed ok → ${admin.email} / ${admin.password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
