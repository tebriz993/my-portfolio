import { Github, Linkedin, Mail, Phone } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-slate-900 dark:bg-slate-950 text-white py-12">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <h3 className="text-2xl font-bold mb-2">
              <span className="font-mono">&lt;</span>Tabriz Latifov
              <span className="font-mono">/&gt;</span>
            </h3>
            <p className="text-slate-400">Full Stack Software Engineer</p>
          </div>
          <div className="flex justify-center space-x-6 mb-8">
            <a
              href="https://github.com/tebriz993"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors"
            >
              <Github className="h-6 w-6" />
            </a>
            <a
              href="https://linkedin.com/in/tabriz-latifov-544307260"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors"
            >
              <Linkedin className="h-6 w-6" />
            </a>
            <a
              href="mailto:latifovtebriz@gmail.com"
              className="text-slate-400 hover:text-white transition-colors"
            >
              <Mail className="h-6 w-6" />
            </a>
            <a
              href="tel:+994507895282"
              className="text-slate-400 hover:text-white transition-colors"
            >
              <Phone className="h-6 w-6" />
            </a>
          </div>
          <div className="border-t border-slate-800 pt-8">
            <p className="text-slate-400 text-sm">
              © 2024 Tabriz Latifov. Built with passion using modern web
              technologies.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
