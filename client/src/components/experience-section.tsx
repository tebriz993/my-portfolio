import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";

const experiences = [
  {
    title: "Middle Software Engineer",
    company: "Ateshgah Insurance OJSC",
    period: "12/2025 - Present",
    location: "Azerbaijan",
    description: "Developing and maintaining core insurance management systems including policy administration, claims processing, and underwriting modules. Building scalable microservices architecture for real-time premium calculations, risk assessment engines, and automated policy lifecycle management. Integrating third-party services for KYC verification, payment gateways, and regulatory compliance reporting.",
    technologies: ["C#", ".NET Framework", ".NET Core", "ASP.NET Core", "Entity Framework Core", "REST APIs", "MS SQL Server", "T-SQL", "ASP.NET MVC", "Design Patterns", "SOLID Principles", "Clean Architecture", "CQRS", "MediatR", "AutoMapper", "FluentValidation", "JSON", "XML", "Swagger/OpenAPI", "Postman", "Git", "Azure DevOps", "CI/CD Pipelines", "Agile/Scrum", "JavaScript", "TypeScript", "React.js", "Microservices", "Docker", "RabbitMQ", "Redis", "SignalR"],
    current: true,
  },

  {
    title: "Back-end Instructor",
    company: "CodeWorld.az",
    period: "08/2024 - Present",
    location: "Azerbaijan",
    description: "Teaching advanced C# and .NET concepts to aspiring developers, focusing on clean code principles, SOLID principles, and industry best practices. Mentoring students through real-world project development.",
    technologies: ["C#", ".NET", ".NET Core", "ASP.NET Core", "ASP.NET MVC", "Entity Framework Core", "LINQ", "REST APIs", "SQL Server", "Onion Architecture", "Repository Pattern", "Unit of Work", "Dependency Injection", "SOLID Principles", "Design Patterns", "Git", "GitHub", "OOP", "Teaching", "Mentoring", "Curriculum Development"],
    current: true,
  },
  {
    title: "Full Stack Software Engineer",
    company: "Freelancer",
    period: "05/2025 - 10/2025",
    location: "USA (Remote)",
    description: "Architecting and implementing end-to-end software solutions, leveraging a microservices backend (C#, .NET) to power engaging and responsive frontend applications built with React.js.",
    technologies: ["C#", ".NET", ".NET Core", "React.js", "JavaScript", "TypeScript", "SQL", "Azure/AWS", "Onion Architecture", "Microservice"],
    current: false,
  },
  {
    title: "Back-end Instructor",
    company: "Software Village",
    period: "08/2024 - 01/2026",
    location: "Azerbaijan",
    description: "Teaching advanced C# and .NET concepts to aspiring developers, focusing on clean code principles and best practices.",
    technologies: ["C#", ".NET", "ASP.NET MVC", "Onion Architecture", ".NET Core", "Teaching", "Mentoring"],
    current: false,
  },
  {
    title: "Software Developer (C#, .NET)",
    company: "Crocusoft (Part-time)",
    period: "01/2025 - 05/2025",
    location: "On-site",
    description: "Developing software solutions using C# and .NET technologies, participating in various company projects and implementations.",
    technologies: ["C#", ".NET", "ASP.NET Core", "Onion Architecture", "Software Development"],
    current: false,
  },
  {
    title: "Full Stack Software Developer",
    company: "DendClub (Hybrid)",
    period: "12/2024 - 05/2025",
    location: "Hybrid (Baku, Azerbaijan)",
    description: "Led a full-stack development team, implementing scalable solutions using C#, .NET, Docker, Kubernetes, and React.js.",
    technologies: ["C#", ".NET", ".NET Core", "ASP.NET Core", "React.js", "JavaScript", "TypeScript", "Docker", "Kubernetes", "Microservices", "Team Leadership"],
    current: false,
  },
  {
    title: "Middle ICT On-site Technical Support Engineer (COP29)",
    company: "KRONOS ICT TEAM, Australia team (Full-time)",
    period: "09/2024 - 12/2024",
    location: "Baku, Azerbaijan",
    description: "Provided critical on-site technical support for the United Nations Climate Change Conference (COP29). Managed network infrastructure, troubleshooted hardware/software issues, and ensured 24/7 uptime for mission-critical conference systems.",
    technologies: ["Network Administration", "Windows Server", "Active Directory", "TCP/IP", "DHCP", "DNS", "VPN", "Cisco Networking", "Hardware Troubleshooting", "Help Desk Support", "ITIL", "ServiceNow", "Remote Desktop", "Video Conferencing Systems", "AV Equipment", "Incident Management", "Technical Documentation"],
    current: false,
  },
  {
    title: "Full Stack Software Developer",
    company: "TIC (Remote)",
    period: "12/2023 - 12/2024",
    location: "USA",
    description: "Developed and maintained full-stack applications using modern web technologies and cloud services. Built RESTful APIs, implemented authentication systems, and deployed scalable solutions to cloud platforms.",
    technologies: ["C#", ".NET", ".NET Core", "ASP.NET Core", "Entity Framework Core", "React.js", "Next.js", "JavaScript", "TypeScript", "Node.js", "AWS", "Azure", "SQL Server", "PostgreSQL", "MongoDB", "Redis", "Docker", "Kubernetes", "CI/CD", "Git", "GitHub Actions", "REST APIs", "GraphQL", "JWT Authentication", "OAuth2"],
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