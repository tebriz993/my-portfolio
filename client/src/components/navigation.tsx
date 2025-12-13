import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Moon, Sun, Menu, Gamepad2 } from "lucide-react";
import { useTheme } from "./theme-provider";
import { Link } from "wouter";

import { trackEvent } from "@/lib/analytics";

// Navigation items will now use translations

export function Navigation() {
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { href: "#about", label: "About" },
    { href: "#experience", label: "Experience" },
    { href: "#skills", label: "Skills" },
    { href: "#projects", label: "Projects" },
    { href: "#contact", label: "Contact" },
  ];

  const scrollToSection = (href: string) => {
    // Track navigation clicks
    trackEvent('navigation', 'click', href.replace('#', ''));
    
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setIsOpen(false);
    }
  };

  return (
    <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-md z-50 border-b border-border">
      <div className="container-custom">
        <div className="flex justify-between items-center py-4">
          <div className="text-xl font-bold text-primary">
            <span className="font-mono">&lt;</span>
            Tabriz
            <span className="font-mono">/&gt;</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-8">
            {navItems.map((item) => (
              <button
                key={item.href}
                onClick={() => scrollToSection(item.href)}
                className="hover:text-primary transition-colors duration-200"
              >
                {item.label}
              </button>
            ))}
            <Link to="/games">
              <button className="flex items-center gap-1 hover:text-primary transition-colors duration-200">
                <Gamepad2 className="h-4 w-4" />
                My Games
              </button>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                trackEvent('theme', 'toggle', theme === 'dark' ? 'to_light' : 'to_dark');
                toggleTheme();
              }}
              className="hover:bg-muted"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>

            {/* Mobile Menu */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <div className="flex flex-col space-y-4 mt-8">
                  {navItems.map((item) => (
                    <button
                      key={item.href}
                      onClick={() => scrollToSection(item.href)}
                      className="text-left py-2 hover:text-primary transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}
                  <Link to="/games">
                    <button 
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2 text-left py-2 hover:text-primary transition-colors"
                    >
                      <Gamepad2 className="h-4 w-4" />
                      My Games
                    </button>
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
