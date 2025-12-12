import { auth } from "@clerk/clerk-react";

export async function getClerkToken() {
  const { getToken } = auth();
  return await getToken();
}