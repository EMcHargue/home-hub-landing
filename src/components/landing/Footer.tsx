import { Home } from "lucide-react";

const Footer = () => (
  <footer className="border-t border-border py-12">
    <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-foreground font-semibold">
        <Home className="h-5 w-5 text-primary" />
        House Manager
      </div>
      <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} House Manager. All rights reserved.</p>
    </div>
  </footer>
);

export default Footer;
