import { earlyAccessFlag } from "~/server/flags";

export default async function Home() {
  const earlyAccess = await earlyAccessFlag();
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Hello World</h1>
      <p className="mt-4 text-lg">This is a simple Next.js app.</p>
      {earlyAccess ? (
        <p className="mt-4 text-lg text-green-500">
          You have early access to this feature!
        </p>
      ) : (
        <p className="mt-4 text-lg text-red-500">
          This feature is not available yet.
        </p>
      )}
    </main>
  );
}
