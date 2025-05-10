# Wahlen Foundation

Wahlen Foundation is an innovative digital voting platform designed to modernize the election process. Built as a solo project by [JackatDJL](https://github.com/JackatDJL) (@DJL / DJL Foundation), it leverages a modern tech stack to provide a secure, accessible, and intuitive experience for both election administrators and voters.

The platform utilizes a multi-domain architecture to separate management functions from the public-facing voting interfaces for different organizations and elections.

**Repository:** `git@github.com:JackatDJL/wahlen-foundation.git`

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/JackatDJL/wahlen-foundation?utm_source=oss&utm_medium=github&utm_campaign=JackatDJL%2Fwahlen-foundation&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

## Primary Goals

- **Modern & Secure Voting:** Implement a robust and user-friendly digital voting system.
- **Accessibility:** Ensure the platform is easily accessible to users regardless of location or device.
- **Security & Integrity:** Prioritize a secure environment for voting, protecting user data and election validity.
- **Innovation:** Utilize cutting-edge web technologies (T3 Stack) for an enhanced experience.
- **User Experience:** Offer a seamless and intuitive UI for both voters and administrators.
- **Scalability:** Design the platform to handle various election types and user loads.

## Technology Stack

This project is built using the **T3 Stack** and related technologies:

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **API Layer:** [tRPC](https://trpc.io/) (End-to-end typesafe APIs)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/) (TypeScript SQL-like ORM)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Authentication:** [Clerk](https://clerk.com/) (_Note: Exploring alternatives like a custom solution for more control over account management and API features._)
- **Database:** [Neon](https://neon.tech/) (Serverless PostgreSQL)
- **Deployment:** [Vercel](https://vercel.com/)

## Project Structure & Domain Architecture

The application operates across multiple domains within a single Next.js project, managed by a custom router logic:

1.  **Root Domain:** [`https://wahlen.djl.foundation`](https://wahlen.djl.foundation)

    - Serves the main landing/marketing page.
    - Handles user authentication (Sign Up, Sign In via Clerk).
    - Provides the central dashboard for logged-in users.
    - Hosts administration pages for creating and managing elections.
    - **Key Routes:**
      - `/`: Landing page / User Dashboard (if logged in)
      - `/api/...`: tRPC API routes
      - `/sign-in`, `/sign-up`: Clerk authentication pages
      - `/manage`: List of elections created by the user
      - `/account`: User account settings (Clerk portal + custom organization settings)
      - `/create`: Interface for creating new elections
      - `/edit/[electionShortname]`: Interface for editing existing elections

2.  **Catch-all Subdomain:** [`{orgname}.wahl.djl.foundation`](https://test.wahl.djl.foundation) (e.g., `test.wahl.djl.foundation`)
    - Dedicated to specific organizations and their elections.
    - The structure follows: `{orgname}.wahl.djl.foundation/{electionshortname}`
    - `wahl.djl.foundation` redirects to the root domain `https://wahlen.djl.foundation`.
    - **Key Routes:**
      - `/`: Organization information screen or dashboard specific to `{orgname}`.
      - `/[electionShortname]`: The actual voting interface for a specific election. (Sub-routes within the election context are TBD).

**Custom Routing:** A custom routing mechanism inspects the `host` header (or `?orgname=` query parameter locally) to determine if the request is for the root domain or a catch-all subdomain. It then renders the appropriate page components and ensures correct data context, preventing accidental access to management pages (like `/manage`) on election subdomains.

## Getting Started

These are basic instructions to get the project running locally.

1.  **Clone the repository:**

    ```bash
    git clone git@github.com:JackatDJL/wahlen-foundation.git
    cd wahlen-foundation
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up environment variables:**

    - Ensure you have the Vercel CLI installed (`npm install -g vercel`).
    - Log in to Vercel (`vercel login`).
    - Link the project (`vercel link`).
    - Pull the development environment variables:
      ```bash
      vercel env pull .env
      # Vercel Normaly pulls to .env.local witch conflicts with some Packages
      ```
    - Ensure the following variables are present in your Vercel project environment (and subsequently pulled):
      - `DATABASE_URL`: Connection string for your Neon database.
      - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Your Clerk publishable key.
      - `CLERK_SECRET_KEY`: Your Clerk secret key.
      - (Add any other necessary variables).

4.  **Database Setup & Migration:**

    - Ensure your Neon database is ready.
    - Run Drizzle migrations to set up the database schema:
      ```bash
      # Apply migrations to the database
      npm run db:push
      ```
    - _(Optional)_ Seed the database with initial data if you have seeding scripts.

5.  **Run the development server:**

    ```bash
    npm run dev
    ```

6.  **Access the application:**
    - Open your browser to `http://localhost:3000` (or your configured port).
    - **Local Testing of Subdomains:** Since `*.localhost` doesn't work reliably, simulate organization subdomains by adding the `?orgname=` query parameter to your localhost URL. For example, access `http://localhost:3000/?orgname=testorg` to simulate the behavior of `testorg.wahl.djl.foundation`. The custom router logic should prioritize this query parameter for local development.

## Usage (High-Level)

1.  Register or log in on the root domain ([`https://wahlen.djl.foundation`](https://wahlen.djl.foundation)).
2.  Navigate to `/create` to set up a new election, defining details and associating it with an organization name (`orgname`).
3.  Manage your created elections via the `/manage` dashboard.
4.  Share the unique election link (`{orgname}.wahl.djl.foundation/{electionshortname}`) with voters (e.g., [`https://test.wahl.djl.foundation/sample-election`](https://test.wahl.djl.foundation/sample-election)).
5.  Voters access their specific link to view election details and cast their vote.

## Contributing

Currently, this project is developed solely by [JackatDJL](https://github.com/JackatDJL). Contributions are not actively sought at this moment, but feel free to open issues for bugs or feature suggestions.

## License

This project is licensed under the **Apache License 2.0**. See the [`LICENSE`](LICENSE) file for details.
