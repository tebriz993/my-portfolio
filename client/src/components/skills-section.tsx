import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Server, Code, Cloud, Database, ChevronDown, ChevronUp } from "lucide-react";
import { 
  SiSharp, SiDotnet, SiReact, SiJavascript, SiTypescript, 
  SiTailwindcss, SiDocker, SiKubernetes, SiAmazon, 
  SiMongodb, SiPostgresql, 
  SiRedis, SiMysql, SiGit, SiGithub, 
  SiPostman, SiSwagger, SiRabbitmq, SiApachekafka, SiElasticsearch,
  SiNodedotjs, SiExpress, SiVuedotjs, SiAngular, SiBootstrap,
  SiMui, SiNextdotjs, SiNuxtdotjs, SiSqlite, SiOracle,
  SiFirebase, SiSupabase, SiGraphql,
  SiApollographql, SiJenkins, SiGitlab, SiNginx, SiLinux,
  SiTerraform, SiGrafana
} from "react-icons/si";

// Technologies I Work With - Visual Icons
const technologies = [
  { name: "C#", icon: SiSharp, color: "text-purple-600" },
  { name: ".NET", icon: SiDotnet, color: "text-purple-700" },
  { name: "React", icon: SiReact, color: "text-blue-500" },
  { name: "JavaScript", icon: SiJavascript, color: "text-yellow-500" },
  { name: "TypeScript", icon: SiTypescript, color: "text-blue-600" },
  { name: "Docker", icon: SiDocker, color: "text-blue-600" },
  { name: "Kubernetes", icon: SiKubernetes, color: "text-blue-700" },
  { name: "AWS", icon: SiAmazon, color: "text-orange-500" },
  { name: "PostgreSQL", icon: SiPostgresql, color: "text-blue-700" },
  { name: "MS SQL Server", icon: Database, color: "text-red-600" },
  { name: "RabbitMQ", icon: SiRabbitmq, color: "text-orange-600" },
  { name: "Redis", icon: SiRedis, color: "text-red-600" },
  { name: "GraphQL", icon: SiGraphql, color: "text-pink-600" },
  { name: "Swagger", icon: SiSwagger, color: "text-green-600" },
  { name: "Terraform", icon: SiTerraform, color: "text-purple-600" },
  { name: "Grafana", icon: SiGrafana, color: "text-orange-600" },
  { name: "Azure", icon: SiAmazon, color: "text-blue-600" },
  { name: "Apache Kafka", icon: SiApachekafka, color: "text-gray-700" },
  { name: "ElasticSearch", icon: SiElasticsearch, color: "text-yellow-600" },
];

// Define skill categories with progress percentages
const backendSkills = [
  { name: "C#", icon: SiSharp, color: "text-purple-600", progress: 95 },
  { name: ".NET", icon: SiDotnet, color: "text-purple-700", progress: 95 },
  { name: ".NET Core", icon: SiDotnet, color: "text-purple-500", progress: 90 },
  { name: "ASP.NET MVC", icon: SiDotnet, color: "text-purple-800", progress: 88 },
  { name: "Microservices", icon: Server, color: "text-blue-600", progress: 85 },
  { name: "Onion Architecture", icon: Server, color: "text-blue-800", progress: 85 },
  { name: "Entity Framework", icon: Database, color: "text-blue-700", progress: 88 },
  { name: "RabbitMQ", icon: SiRabbitmq, color: "text-orange-600", progress: 75 },
  { name: "Redis", icon: SiRedis, color: "text-red-600", progress: 70 },
];

const frontendSkills = [
  { name: "React.js", icon: SiReact, color: "text-blue-500", progress: 85 },
  { name: "JavaScript", icon: SiJavascript, color: "text-yellow-500", progress: 90 },
  { name: "TypeScript", icon: SiTypescript, color: "text-blue-600", progress: 80 },
  { name: "HTML5 & CSS3", icon: Code, color: "text-orange-600", progress: 95 },
  { name: "Tailwind CSS", icon: SiTailwindcss, color: "text-cyan-500", progress: 85 },
  { name: "Bootstrap", icon: SiBootstrap, color: "text-purple-600", progress: 85 },
  { name: "Material UI", icon: SiMui, color: "text-blue-600", progress: 80 },
  { name: "Redux", icon: SiReact, color: "text-purple-500", progress: 70 },
  { name: "Next.js", icon: SiNextdotjs, color: "text-black", progress: 55 },
];

const devopsCloudSkills = [
  { name: "Azure/AWS", icon: Cloud, color: "text-blue-600", progress: 80 },
  { name: "Docker", icon: SiDocker, color: "text-blue-600", progress: 85 },
  { name: "Kubernetes", icon: SiKubernetes, color: "text-blue-700", progress: 75 },
  { name: "CI/CD Pipelines", icon: Server, color: "text-green-600", progress: 80 },
  { name: "Git", icon: SiGit, color: "text-orange-600", progress: 95 },
  { name: "GitHub", icon: SiGithub, color: "text-black", progress: 90 },
  { name: "GitLab", icon: SiGitlab, color: "text-orange-600", progress: 80 },
  { name: "Jenkins", icon: SiJenkins, color: "text-blue-800", progress: 75 },
  { name: "Nginx", icon: SiNginx, color: "text-green-700", progress: 75 },
  { name: "Linux", icon: SiLinux, color: "text-black", progress: 80 },
];

const databaseSkills = [
  { name: "SQL", icon: Database, color: "text-blue-800", progress: 90 },
  { name: "MS SQL Server", icon: Database, color: "text-blue-800", progress: 90 },
  { name: "PostgreSQL", icon: SiPostgresql, color: "text-blue-700", progress: 85 },
  { name: "MySQL", icon: SiMysql, color: "text-blue-600", progress: 85 },
  { name: "MongoDB", icon: SiMongodb, color: "text-green-600", progress: 70 },
  { name: "Redis", icon: SiRedis, color: "text-red-600", progress: 70 },
  { name: "Firebase", icon: SiFirebase, color: "text-yellow-600", progress: 75 },
];

const teachingSkills = [
  { name: "Teaching", icon: Code, color: "text-green-600", progress: 85 },
  { name: "Mentoring", icon: Code, color: "text-blue-600", progress: 80 },
  { name: "Code Review", icon: Code, color: "text-purple-600", progress: 85 },
  { name: "Technical Writing", icon: Code, color: "text-orange-600", progress: 75 },
];

export function SkillsSection() {
  const [isExpanded, setIsExpanded] = useState(true);

  const skillCategories = [
    {
      title: "Backend Development", 
      icon: Server,
      skills: backendSkills,
      color: "text-purple-600"
    },
    {
      title: "Frontend Development",
      icon: Code,
      skills: frontendSkills,
      color: "text-blue-600"
    },
    {
      title: "DevOps & Cloud",
      icon: Cloud,
      skills: devopsCloudSkills,
      color: "text-green-600"
    },
    {
      title: "Databases",
      icon: Database,
      skills: databaseSkills,
      color: "text-orange-600"
    },
    {
      title: "Teaching & Mentoring",
      icon: Code,
      skills: teachingSkills,
      color: "text-emerald-600"
    }
  ];

  return (
    <section id="skills" className="section-padding">
      <div className="container-custom">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl md:text-4xl font-bold">
              Technical Skills
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
            <div>
              {/* Technologies I Work With - Visual Icons */}
              <div className="mb-12">
                <h3 className="text-2xl md:text-3xl font-bold text-center mb-8">
                  Technologies I Work With
                </h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-4 md:gap-6">
                  {technologies.map((tech, index) => (
                    <div key={index} className="flex flex-col items-center group">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-800 dark:bg-gray-700 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 mb-2">
                        <tech.icon className={`w-8 h-8 md:w-10 md:h-10 ${tech.color}`} />
                      </div>
                      <span className="text-xs md:text-sm font-medium text-center leading-tight">
                        {tech.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-8">
                {skillCategories.map((category, index) => {
                const IconComponent = category.icon;
                return (
                  <Card key={index} className="h-fit">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className={`p-2 rounded-lg bg-muted ${category.color}`}>
                          <IconComponent className="h-6 w-6" />
                        </div>
                        <h3 className="text-xl font-semibold">{category.title}</h3>
                      </div>
                      
                      <div className="space-y-4">
                        {category.skills.map((skill, skillIndex) => {
                          const SkillIcon = skill.icon;
                          return (
                            <div key={skillIndex} className="flex items-center gap-3">
                              <div className={`${skill.color} flex-shrink-0`}>
                                <SkillIcon className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium truncate">{skill.name}</span>
                                  <span className="text-xs text-muted-foreground">{skill.progress}%</span>
                                </div>
                                <Progress value={skill.progress} className="h-2" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}