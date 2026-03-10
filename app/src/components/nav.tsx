"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
    { href: "/", label: "Protect" },
    { href: "/detect", label: "Detect" },
    { href: "/how-it-works", label: "How It Works" },
];

export function Nav() {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <header className="fixed top-0 left-0 right-0 z-50 glass">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="relative">
                            <Shield className="h-7 w-7 text-[hsl(265,89%,68%)] transition-transform group-hover:scale-110" />
                            <div className="absolute inset-0 bg-[hsl(265,89%,68%)] rounded-full blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
                        </div>
                        <span className="text-lg font-bold gradient-text">
                            PaperShield
                        </span>
                    </Link>

                    {/* Desktop nav */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navLinks.map((link) => {
                            const isActive = pathname === link.href;
                            return (
                                <Link key={link.href} href={link.href}>
                                    <Button
                                        variant={isActive ? "default" : "ghost"}
                                        size="sm"
                                        className={
                                            isActive
                                                ? "bg-[hsl(265,89%,68%)] text-white hover:bg-[hsl(265,89%,60%)]"
                                                : "text-muted-foreground hover:text-foreground"
                                        }
                                    >
                                        {link.label}
                                    </Button>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Mobile menu button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden"
                        onClick={() => setMobileOpen(!mobileOpen)}
                    >
                        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </Button>
                </div>
            </div>

            {/* Mobile menu */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden glass border-t border-border/50"
                    >
                        <nav className="flex flex-col p-4 gap-2">
                            {navLinks.map((link) => {
                                const isActive = pathname === link.href;
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setMobileOpen(false)}
                                    >
                                        <Button
                                            variant={isActive ? "default" : "ghost"}
                                            className={`w-full justify-start ${isActive
                                                ? "bg-[hsl(265,89%,68%)] text-white"
                                                : "text-muted-foreground"
                                                }`}
                                        >
                                            {link.label}
                                        </Button>
                                    </Link>
                                );
                            })}
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
