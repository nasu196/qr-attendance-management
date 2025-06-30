import { SignOutButton, useUser } from "@clerk/clerk-react";
import { Button } from "./ui/button";

export function ClerkSignOut() {
  const { user } = useUser();

  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">
        {user.emailAddresses[0]?.emailAddress || user.fullName || "ユーザー"}
      </span>
      <SignOutButton>
        <Button variant="outline" size="sm">
          ログアウト
        </Button>
      </SignOutButton>
    </div>
  );
} 