"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Droplet, Menu, X, ArrowUpRight } from "lucide-react";
// Link removed

const navLinks = [
  { label: "How it works", href: "#how-it-works", view: "" },
  { label: "Features", href: "#features", view: "" },
  { label: "For donors", href: "#donors", view: "donor-register" },
  { label: "For hospitals", href: "#hospitals", view: "hospital-register" },
  { label: "Impact", href: "#impact", view: "" },
  { label: "FAQ", href: "#faq", view: "" },
];

import { User as DonorUser, Requester } from "../types";

interface NavbarProps {
  onNavigate: (view: any) => void;
  loggedInUser?: DonorUser | null;
  loggedInRequester?: Requester | null;
}

export function Navbar({ onNavigate, loggedInUser, loggedInRequester }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50 flex justify-center px-3 pt-3 sm:px-6 sm:pt-4"
    >
      <nav
        className={`flex w-full max-w-6xl items-center justify-between rounded-2xl px-3 py-2.5 sm:px-5 sm:py-3 transition-all duration-500 ${
          scrolled
            ? "glass shadow-premium"
            : "bg-white/40 backdrop-blur-md border border-white/40"
        }`}
      >
        <a href="#top" className="flex items-center gap-2 group">
          <div className="relative grid h-8 w-8 place-items-center rounded-xl blood-drop-gradient shadow-[0_8px_20px_-4px_rgba(244,63,87,0.5)]">
            <Droplet className="h-4 w-4 text-white fill-white" strokeWidth={2.2} />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white" />
          </div>
          <span className="text-[16px] font-extrabold tracking-tight text-ink-900 font-sans flex items-center">
            FindMy<span className="text-blood-600">Donor</span><span className="text-[10px] font-bold text-ink-400 ml-0.5 -translate-y-1">™</span>
          </span>
        </a>

        <div className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            link.view ? (
              <button
                key={link.href}
                onClick={() => onNavigate(link.view)}
                className="relative rounded-full px-3.5 py-1.5 text-[13.5px] font-medium text-ink-600 transition-colors hover:text-ink-900 cursor-pointer"
              >
                {link.label}
              </button>
            ) : (
              <a
                key={link.href}
                href={link.href}
                className="relative rounded-full px-3.5 py-1.5 text-[13.5px] font-medium text-ink-600 transition-colors hover:text-ink-900"
              >
                {link.label}
              </a>
            )
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          {!loggedInUser && !loggedInRequester ? (
            <>
              <button
                onClick={() => onNavigate('auth-signin')}
                className="rounded-full px-3.5 py-1.5 text-[13.5px] font-medium text-ink-700 hover:text-ink-900 transition cursor-pointer"
              >
                Sign in
              </button>
              <button
                onClick={() => onNavigate('request')}
                className="btn-glow group inline-flex items-center gap-1 rounded-full bg-ink-900 px-4 py-2 text-[13.5px] font-medium text-white shadow-[0_8px_20px_-4px_rgba(13,10,10,0.3)] hover:bg-black cursor-pointer"
              >
                Find Blood Now
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => onNavigate(loggedInUser ? 'donor-dashboard' : 'requester-portal')}
              className="btn-glow group inline-flex items-center gap-1 rounded-full bg-blood-50 text-blood-700 border border-blood-200 px-4 py-2 text-[13.5px] font-bold shadow-[0_8px_20px_-4px_rgba(244,63,87,0.3)] hover:bg-blood-100 cursor-pointer"
            >
              {loggedInUser ? 'Donor Dashboard' : 'Requester Dashboard'}
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => setOpen((s) => !s)}
          aria-label="Toggle menu"
          className="grid md:hidden h-9 w-9 place-items-center rounded-full bg-ink-900 text-white"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="absolute top-20 left-3 right-3 rounded-2xl glass shadow-premium-lg p-3 md:hidden"
          >
            <div className="flex flex-col">
              {navLinks.map((l) => (
                l.view ? (
                  <button
                    key={l.href}
                    onClick={() => {
                      setOpen(false);
                      onNavigate(l.view);
                    }}
                    className="rounded-xl px-4 py-3 text-sm font-medium text-ink-700 hover:bg-ink-100 text-left"
                  >
                    {l.label}
                  </button>
                ) : (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-medium text-ink-700 hover:bg-ink-100"
                  >
                    {l.label}
                  </a>
                )
              ))}
              {!loggedInUser && !loggedInRequester ? (
                <>
                  <button
                    onClick={() => {
                      setOpen(false);
                      onNavigate('auth-signin');
                    }}
                    className="mt-2 rounded-xl bg-ink-100 px-4 py-3 text-sm font-medium text-ink-900 text-center"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => {
                      setOpen(false);
                      onNavigate('request');
                    }}
                    className="mt-2 rounded-xl bg-ink-900 px-4 py-3 text-sm font-medium text-white text-center"
                  >
                    Find Blood Now
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setOpen(false);
                    onNavigate(loggedInUser ? 'donor-dashboard' : 'requester-portal');
                  }}
                  className="mt-2 rounded-xl bg-blood-600 px-4 py-3 text-sm font-medium text-white text-center shadow-lg"
                >
                  My Dashboard
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
