import { Card, CardContent } from "@/components/ui/card";

export function AboutSection() {
  return (
    <section id="about" className="section-padding">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            About Me
          </h2>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <img
                src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"
                alt="Software engineering workspace"
                className="rounded-lg w-full h-80 object-cover"
              />
            </div>
            <div>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                As a highly experienced Full Stack Software Engineer, I have consistently delivered scalable and high-performance web applications using technologies such as C#, .NET, Microservices, JavaScript, TypeScript, React.js, as well as modern cloud services and deployment tools across a wide variety of projects and industries.
              </p>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                I have a proven track record of leading development teams and architecting robust microservice solutions. My expertise spans from backend API development to intuitive frontend interfaces, with a strong focus on clean code and efficient, modular architectures.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Card className="text-center h-24 flex items-center justify-center">
                  <CardContent className="p-3">
                    <div className="text-xl font-bold text-primary mb-1">30+</div>
                    <p className="text-xs text-muted-foreground">Completed Projects</p>
                  </CardContent>
                </Card>
                <Card className="text-center h-24 flex items-center justify-center">
                  <CardContent className="p-3">
                    <div className="text-xl font-bold text-primary mb-1">AI & ML</div>
                    <p className="text-xs text-muted-foreground">Data-Driven Solutions</p>
                  </CardContent>
                </Card>
                <Card className="text-center h-24 flex items-center justify-center">
                  <CardContent className="p-3">
                    <div className="text-xl font-bold text-primary mb-1">5+</div>
                    <p className="text-xs text-muted-foreground">Global Conferences</p>
                  </CardContent>
                </Card>
                <Card className="text-center h-24 flex items-center justify-center">
                  <CardContent className="p-3">
                    <div className="text-xl font-bold text-primary mb-1">3</div>
                    <p className="text-xs text-muted-foreground">Published Articles</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}