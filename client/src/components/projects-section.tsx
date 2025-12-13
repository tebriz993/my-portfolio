import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Github, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

// Project images
import ecommerceImage from "@assets/ECommerceMicroservicePicture.png";
import jobSearchImage from "@assets/JobSearchApp.png";
import softwareVillageImage from "@assets/SoftwareVillage.png";
import dendClubImage from "@assets/DendClub.png";
import ecommerceAppImage from "@assets/ECommerceApp.png";
import lawProjectImage from "@assets/LawProject.png";
import shopECommerceImage from "@assets/ShopECommerce.png";

// Featured Projects
const staticProjects = [
  {
    id: 1,
    name: "ECommerceMicroservice",
    description: "Modern microservices-based e-commerce platform with distributed architecture.",
    image: ecommerceImage,
    technologies: ["C#", ".NET", "REST API", "RabbitMQ", "Elasticsearch", "Redis"],
    githubUrl: "https://github.com/tebriz993/ECommerceMicroservice",
    liveUrl: null,
    status: "Pending",
    featured: true
  },
  {
    id: 2,
    name: "JobSearchApp",
    description: "A comprehensive platform for searching and managing job applications.",
    image: jobSearchImage,
    technologies: ["C#", ".NET", "RestAPI", "Clean Architecture"],
    githubUrl: "https://github.com/tebriz993/JobSearch-App",
    liveUrl: null,
    status: "Featured",
    featured: true
  },
  {
    id: 3,
    name: "SoftwareVillage",
    description: "A project for the Software Village course, demonstrating core software principles.",
    image: softwareVillageImage,
    technologies: ["C#", ".NET Core MVC", "MVVM", "MVC Architecture"],
    githubUrl: "https://github.com/tebriz993/SoftwareVillage",
    liveUrl: null,
    status: "Featured",
    featured: true
  },
  {
    id: 4,
    name: "DendClub",
    description: "A healthcare system project designed to manage patient and clinical data efficiently.",
    image: dendClubImage,
    technologies: ["C#", ".NET", "RestAPI", "JavaScript", "TypeScript", "React.js"],
    githubUrl: "https://github.com/tebriz993/DendClub",
    liveUrl: null,
    status: "Featured",
    featured: true
  },
  {
    id: 5,
    name: "ECommerceApp",
    description: "A full-featured e-commerce application built with an N-layer architecture.",
    image: ecommerceAppImage,
    technologies: ["C#", ".NET", ".NET MVC", "MVVM", "N-layer Architecture", "jQuery"],
    githubUrl: "https://github.com/tebriz993/ECommerceApp",
    liveUrl: null,
    status: "Featured",
    featured: true
  },
  {
    id: 6,
    name: "LawProject",
    description: "A specialized application designed to assist legal professionals and law firms.",
    image: lawProjectImage,
    technologies: ["C#", ".NET Core MVC", "MVVM"],
    githubUrl: "https://github.com/tebriz993/Law_Project",
    liveUrl: null,
    status: "Featured",
    featured: true
  },
  {
    id: 7,
    name: "ShopECommerce",
    description: "A corporate e-commerce solution with Onion Architecture and Elasticsearch.",
    image: shopECommerceImage,
    technologies: ["C#", ".NET", "RestAPI", "Onion Architecture", "ElasticSearch"],
    githubUrl: "https://github.com/tebriz993/ShopECommerce",
    liveUrl: null,
    status: "Featured",
    featured: true
  },
];

export function ProjectsSection() {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <section id="projects" className="section-padding bg-muted/50">
      <div className="container-custom">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl md:text-4xl font-bold">
              Featured Projects
            </h2>
            <Button
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>

          {isExpanded && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {staticProjects.map((project) => (
                <Card key={project.id} className="group hover:shadow-lg transition-shadow duration-300">
                  <div className="aspect-video overflow-hidden rounded-t-lg">
                    <img
                      src={project.image}
                      alt={project.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIyNSIgdmlld0JveD0iMCAwIDQwMCAyMjUiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMjI1IiBmaWxsPSIjZjMfNGY2Ii8+CjxwYXRoIGQ9Ik0yMDAgMTEyLjVMMTc1IDg3LjVMMjAwIDYyLjVMMjI1IDg3LjVMMjAwIDExMi41WiIgZmlsbD0iIzk5YTNhZiIvPgo8L3N2Zz4K';
                      }}
                    />
                  </div>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-lg">{project.name}</h3>
                      <Badge 
                        variant={project.status === "Pending" ? "outline" : "default"}
                        className="text-xs"
                      >
                        {project.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                      {project.description}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {project.technologies?.map((tech) => (
                        <Badge key={tech} variant="secondary" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      {project.githubUrl && (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={project.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1"
                          >
                            <Github className="h-4 w-4" />
                            Code
                          </a>
                        </Button>
                      )}
                      {project.liveUrl && (
                        <Button size="sm" asChild>
                          <a
                            href={project.liveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Live Demo
                          </a>
                        </Button>
                      )}
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