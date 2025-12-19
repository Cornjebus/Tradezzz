import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <SignUp
        appearance={{
          elements: {
            rootBox: "w-full max-w-md",
            card: "bg-card border border-border shadow-xl shadow-indigo-500/10",
            headerTitle: "text-foreground",
            headerSubtitle: "text-muted-foreground",
            socialButtonsBlockButton: "bg-secondary border-border text-foreground hover:bg-muted",
            formFieldLabel: "text-muted-foreground",
            formFieldInput: "bg-secondary border-border text-foreground focus:border-primary",
            footerActionLink: "text-indigo-400 hover:text-indigo-300",
            formButtonPrimary: "bg-primary hover:bg-primary/90",
          }
        }}
      />
    </div>
  );
}
