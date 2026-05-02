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
             As a Senior Backend and DevOps Engineer with a strong focus on product development, I specialize in building scalable, high-performance distributed systems. My core expertise lies in the .NET ecosystem and Java/Spring, along with TypeScript, JavaScript, and React.js for responsive UIs
              </p>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
               I have extensive experience designing Microservices and automating cloud infrastructure with Docker, Kubernetes, and CI/CD pipelines. I follow Clean Architecture, CQRS, and Event-Driven patterns (Kafka/RabbitMQ), and focus on engineering excellence, state management (Redux/Zustand), and seamless API integration to deliver end-to-end solutions.
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
                    <div className="text-xl font-bold text-primary mb-1">4</div>
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
