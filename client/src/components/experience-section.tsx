import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";

const experiences = [
  {
    title: "Full Stack Software Engineer",
    company: "Freelancer",
    period: "05/2025 - Present",
    location: "USA (Remote)",
    description: "Architecting and implementing end-to-end software solutions, leveraging a microservices backend (C#, .NET) to power engaging and responsive frontend applications built with React.js.",
    technologies: ["C#", ".NET", ".NET Core", "React.js", "JavaScript", "TypeScript", "SQL", "Azure/AWS", "Onion Architecture", "Microservice"],
    current: true,
  },
  {
    title: "Back-end Instructor",
    company: "Software Village & CodeWorld.az",
    period: "08/2024 - Present",
    location: "Azerbaijan",
    description: "Teaching advanced C# and .NET concepts to aspiring developers, focusing on clean code principles and best practices.",
    technologies: ["C#", ".NET", "ASP.NET MVC", "Onion Architecture", ".NET Core", "Teaching", "Mentoring"],
    current: true,
  },
  {
    title: "Software Developer (C#, .NET)",
    company: "Crocusoft (Part-time)",
    period: "01/2025 - 05/2025",
    location: "Remote",
    description: "Developing software solutions using C# and .NET technologies, participating in various company projects and implementations.",
    technologies: ["C#", ".NET", "ASP.NET Core", "Onion Architecture", "Software Development"],
    current: false,
  },
  {
    title: "Full Stack Software Developer",
    company: "DendClub (Hybrid)",
    period: "12/2024 - 05/2025",
    location: "Azerbaijan",
    description: "Led a full-stack development team, implementing scalable solutions using C#, .NET, Docker, Kubernetes, and React.js.",
    technologies: ["C#", ".NET", ".NET Core", "ASP.NET Core", "React.js", "JavaScript", "TypeScript", "Docker", "Kubernetes", "Microservices", "Team Leadership"],
    current: false,
  },
  {
    title: "Middle ICT On-site Technical Support Engineer (COP29)",
    company: "KRONOS ICT TEAM, Australia team (Full-time)",
    period: "09/2024 - 12/2024",
    location: "Baku, Azerbaijan",
    description: "Provided technical support and infrastructure management for COP29 conference, ensuring seamless ICT operations.",
    technologies: ["Technical Support", "Infrastructure", "ICT Management"],
    current: false,
  },
  {
    title: "Full Stack Software Developer",
    company: "TIC (Remote)",
    period: "12/2023 - 12/2024",
    location: "USA",
    description: "Developed and maintained full-stack applications using modern web technologies and cloud services.",
    technologies: ["C#", ".NET", ".NET Core", "ASP.NET Core", "React.js", "JavaScript", "TypeScript", "AWS", "Azure", "SQL", "Cloud Services", "Web Development"],
    current: false,
  },
];

export function ExperienceSection() {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <section id="experience" className="section-padding bg-muted/50">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl md:text-4xl font-bold">
              Work Experience
            </h2>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>

          {isExpanded && (
            <div className="space-y-6">
              {experiences.map((exp, index) => (
                <Card key={index} className="relative">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-foreground mb-2">
                          {exp.title}
                        </h3>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-muted-foreground mb-3">
                          <span className="font-medium text-primary">{exp.company}</span>
                          <span className="hidden sm:inline">•</span>
                          <span>{exp.location}</span>
                        </div>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`self-start mt-2 md:mt-0 ${exp.current ? 'bg-green-100 text-green-800 border-green-200' : ''}`}
                      >
                        {exp.period}
                      </Badge>
                    </div>
                    
                    <p className="text-muted-foreground mb-4 leading-relaxed">
                      {exp.description}
                    </p>
                    
                    <div className="flex flex-wrap gap-2">
                      {exp.technologies.map((tech) => (
                        <Badge key={tech} variant="secondary" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}