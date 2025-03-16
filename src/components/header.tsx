"use client";

import Image from "next/image";
import { ThemeToggle } from "./theme-toggle";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { Button } from "./ui/button";
import { AsyncHomeLink, AsyncLink } from "./asyncLink";

export default function Header() {
  const userButtonAppearance = {
    elements: {
      userButtonAvatarBox: "w-10 h-10",
    },
  };

  return (
    <header className="border-b bg-background print:border-none">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <div className="flex items-center space-x-4">
          <AsyncHomeLink
            searchParams={{}}
            className="flex items-center space-x-2 print:text-foreground print:no-underline"
            spinIt={false}
          >
            <div className="relative h-10 w-10">
              <Image
                src="/logo.png"
                alt="Wahlen Foundation Logo"
                fill
                className="object-contain"
              />
            </div>
            <span className="text-xl font-semibold">Wahlen Foundation</span>
            <span className="hidden font-semibold print:block print:text-xl">
              by DJL
            </span>
          </AsyncHomeLink>
        </div>

        <div className="flex items-center space-x-4 print:hidden">
          <ThemeToggle />
          <SignedIn>
            <Button asChild>
              <AsyncLink searchParams={{}} href="/dashboard">
                Dashboard
              </AsyncLink>
            </Button>
          </SignedIn>

          <div className="relative h-10">
            <SignedIn>
              <UserButton showName appearance={userButtonAppearance} />
            </SignedIn>
            <SignedOut>
              <Button className="flex h-10 items-center space-x-4" asChild>
                <SignInButton />
              </Button>
            </SignedOut>
          </div>
        </div>
      </div>
    </header>
  );
}
