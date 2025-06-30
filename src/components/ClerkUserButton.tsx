import { UserButton } from "@clerk/clerk-react";

export function ClerkUserButton() {
  return (
    <UserButton 
      appearance={{
        elements: {
          avatarBox: "w-10 h-10",
          userButtonPopoverCard: "shadow-lg",
          userButtonPopoverActions: "space-y-1",
        },
      }}
      showName={false}
      afterSignOutUrl="/"
    />
  );
} 