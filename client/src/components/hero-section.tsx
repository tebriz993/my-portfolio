// client/src/components/hero-section.tsx

// 1. Lazımi komponentləri və kitabxananı import edirik
import { Button } from "@/components/ui/button";
import { Github, Linkedin, Mail, Download } from "lucide-react";
import { TypeAnimation } from "react-type-animation";
import tabrizPhoto from "@/assets/profile-image.png";
import { trackEvent } from "@/lib/analytics";


export function HeroSection() {

  const scrollToContact = () => {
    const element = document.querySelector("#contact");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const downloadCV = () => {
    // Track CV download event
    trackEvent('download', 'cv', 'hero_section');

    const link = document.createElement('a');
    link.href = '/Tabriz Latifov -- Software and DevSecOps Engineer.pdf';
    link.download = 'Tabriz Latifov -- Software and DevSecOps Engineer.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="pt-24 pb-16 gradient-bg">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <img
              src={tabrizPhoto}
              alt="Tabriz Latifov"
              className="rounded-full mx-auto w-64 h-64 object-cover border-4 border-background"
            />
          </div>

          {/* --- DƏYİŞİKLİK BURADADIR --- */}
          {/* 2. Köhnə <Badge> komponentini silib, yerinə <TypeAnimation> əlavə edirik */}
          {/* Mətn dəyişdikcə səhifənin "atlamaması" üçün ona bir min-height veririk */}
          <div className="mb-4 text-xl md:text-2xl font-semibold min-h-[64px] flex items-center justify-center">
            <TypeAnimation
              sequence={[
                "Hi, I'm Tabriz!",
                1000,
                "Full Stack Software Engineer",
                1000,
                "Building innovative web solutions",
                1500,
              ]}
              wrapper="span"
              speed={50}
              repeat={Infinity}
            />
          </div>
          {/* --- DƏYİŞİKLİK BİTDİ --- */}


          <p className="text-lg mb-8 max-w-2xl mx-auto text-muted-foreground leading-relaxed">
            A skilled software engineer dedicated to building modern, scalable web solutions. I leverage strong algorithmic thinking to tackle complex challenges and deliver high-quality code.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button onClick={scrollToContact} size="lg" className="px-8">
              Contact Me
            </Button>
            <Button variant="outline" size="lg" className="px-8" onClick={downloadCV}>
              <Download className="mr-2 h-4 w-4" />
              Download CV
            </Button>
          </div>

          <div className="flex justify-center space-x-6">
            <a
              href="https://github.com/tebriz993"
              className="text-muted-foreground hover:text-primary transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent('click', 'social_media', 'github')}
            >
              <Github className="h-6 w-6" />
            </a>
            <a
              href="https://linkedin.com/in/tabriz-latifov-544307260"
              className="text-muted-foreground hover:text-primary transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent('click', 'social_media', 'linkedin')}
            >
              <Linkedin className="h-6 w-6" />
            </a>
            <a
              href="https://mail.google.com/mail/?view=cm&fs=1&to=latifovtebriz@gmail.com"
              className="text-muted-foreground hover:text-primary transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent('click', 'social_media', 'email')}
            >
              <Mail className="h-6 w-6" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
