import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, BookOpen, ChevronDown, ChevronUp, Download } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const education = [
  {
    institution: "UNISER Academy",
    degree: "Advanced Backend Development with C# .NET",
    period: "2024",
    location: "Baku, Azerbaijan",
    description: "Specialized program focusing on advanced C# .NET development, microservices architecture, and enterprise-level backend systems.",
    status: "completed"
  },
  {
    institution: "MyMentorship and Development Agency",
    degree: "Advanced Frontend Development",
    period: "2024", 
    location: "Baku, Azerbaijan",
    description: "Comprehensive training in modern frontend technologies including HTML5, CSS3, JavaScript, and React.js framework.",
    status: "completed"
  },
  {
    institution: "Software Village",
    degree: "Backend Development with C# .NET",
    period: "2023",
    location: "Baku, Azerbaijan", 
    description: "Intensive backend development program covering C# MVC architecture, database design, and web API development.",
    status: "completed"
  },
  {
    institution: "Baku Engineering University",
    degree: "Computer Engineering",
    period: "2022 - 2026",
    location: "Baku, Azerbaijan",
    description: "Bachelor's degree in Computer Engineering with focus on software development, algorithms, and system design.",
    status: "completed"
  }
];

const achievements = [
  {
    title: "Will artificial intelligence replace humans?",
    organization: "British Congress of Mathematics",
    type: "publication",
    year: "2024",
    description: "Research article published in Scopus indexed journal examining the future relationship between AI and human capabilities.",
    downloadUrl: "/assets/Article AI by Tabriz Latifov.pdf",
    status: "published"
  },
  {
    title: "JavaScript Certificate",
    organization: "CISCO Networking Academy",
    type: "certificate", 
    year: "2023",
    description: "Comprehensive JavaScript programming certification covering ES6+, DOM manipulation, and modern web development.",
    downloadUrl: "/assets/CISCO Certificate.png",
    status: "completed"
  },
  {
    title: "Algorithms & Data Structures",
    organization: "Stanford University (Coursera)",
    type: "certificate",
    year: "2023", 
    description: "Advanced algorithms and data structures course covering complexity analysis, graph algorithms, and optimization techniques.",
    downloadUrl: "/assets/Stanford - Algorithms Coursera.pdf",
    status: "completed"
  },
  {
    title: "Computer Science and Programming using Python",
    organization: "MITx 6.00",
    type: "certificate",
    year: "2022",
    description: "Introduction to computer science using Python, covering computational thinking, algorithms, and data structures.",
    downloadUrl: "/assets/MITx 6.00.pdf", 
    status: "completed"
  },
  {
    title: "C# Programming",
    organization: "Coursera",
    type: "certificate",
    year: "2022",
    description: "Complete C# programming course covering object-oriented programming, .NET framework, and application development.",
    downloadUrl: "/assets/Coursera C#.pdf",
    status: "completed"
  },
  {
    title: "Data Structure and OOP",
    organization: "Programming Academy",
    type: "certificate", 
    year: "2022",
    description: "Advanced course on data structures and object-oriented programming principles with practical implementations.",
    downloadUrl: "/assets/Data Structured Certificate.pdf",
    status: "completed"
  },
  {
    title: "C++ Programming", 
    organization: "Coursera",
    type: "certificate",
    year: "2021",
    description: "Comprehensive C++ programming course covering memory management, templates, and advanced programming concepts.",
    downloadUrl: "/assets/Coursera C++.pdf",
    status: "completed"
  }
];

export function EducationSection() {
  const [isEducationExpanded, setIsEducationExpanded] = useState(true);
  const [isAchievementsExpanded, setIsAchievementsExpanded] = useState(true);

  const handleDownload = (url: string, title: string) => {
    trackEvent('download', 'certificate', title);
    const link = document.createElement('a');
    link.href = url;
    link.download = url.split('/').pop() || title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section id="education" className="section-padding">
      <div className="container-custom">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Education & Achievements
          </h2>

          {/* Education Section */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <BookOpen className="h-6 w-6 text-primary" />
                <h3 className="text-2xl font-bold">Education</h3>
              </div>
              <button
                onClick={() => setIsEducationExpanded(!isEducationExpanded)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {isEducationExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {isEducationExpanded ? 'Collapse' : 'Expand'}
              </button>
            </div>

            {isEducationExpanded && (
              <div className="grid md:grid-cols-2 gap-6">
                {education.map((edu, index) => (
                  <Card key={index}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-bold text-lg leading-tight">{edu.degree}</h4>
                        <Badge variant="outline" className="text-xs">
                          {edu.period}
                        </Badge>
                      </div>
                      <p className="font-medium text-primary mb-2">{edu.institution}</p>
                      <p className="text-sm text-muted-foreground mb-3">{edu.location}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {edu.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Achievements Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Award className="h-6 w-6 text-primary" />
                <h3 className="text-2xl font-bold">Certificates & Achievements</h3>
              </div>
              <button
                onClick={() => setIsAchievementsExpanded(!isAchievementsExpanded)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {isAchievementsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {isAchievementsExpanded ? 'Collapse' : 'Expand'}
              </button>
            </div>

            {isAchievementsExpanded && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {achievements.map((achievement, index) => (
                  <Card key={index} className="relative group hover:shadow-lg transition-shadow duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm leading-tight mb-2 line-clamp-2">
                            {achievement.title}
                          </h4>
                          <p className="text-xs text-primary font-medium mb-1">
                            {achievement.organization}
                          </p>
                          <div className="flex items-center gap-2 mb-3">
                            <Badge variant="secondary" className="text-xs">
                              {achievement.type}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {achievement.year}
                            </Badge>
                          </div>
                        </div>
                        {achievement.downloadUrl && (
                          <button
                            onClick={() => handleDownload(achievement.downloadUrl!, achievement.title)}
                            className="ml-2 p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors flex-shrink-0"
                            title="Download Certificate"
                          >
                            <Download className="h-4 w-4 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {achievement.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}