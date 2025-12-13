# Portfolio Website

## Overview
A modern, responsive portfolio website built for Tabriz Latifov, a Full Stack Software Engineer. The application showcases professional experience, skills, projects, and education through an elegant, interactive interface with dark/light theme support.

## System Architecture
The application follows a full-stack monorepo architecture with clear separation between client and server code:

- **Frontend**: React with TypeScript, utilizing modern UI components and responsive design
- **Backend**: Express.js server with TypeScript for API endpoints and static file serving
- **Database**: PostgreSQL with Drizzle ORM for data modeling (ready for future contact form implementation)
- **Build System**: Vite for fast development and optimized production builds
- **Styling**: Tailwind CSS with shadcn/ui components for consistent design system

## Key Components

### Frontend Architecture
- **React 18** with TypeScript for type-safe component development
- **Wouter** for lightweight client-side routing
- **TanStack Query** for efficient data fetching and caching
- **shadcn/ui** component library built on Radix UI primitives
- **Tailwind CSS** for utility-first styling with custom design tokens
- **Theme Provider** for dark/light mode switching with persistence

### Backend Architecture
- **Express.js** server with TypeScript for type safety
- **GitHub API integration** for dynamically fetching and displaying repositories
- **Development middleware** with Vite integration for hot reloading
- **Error handling** with structured error responses
- **CORS and security** considerations for production deployment

### Database Schema
- **Users table** for potential authentication features
- **Contacts table** for contact form submissions
- **Drizzle ORM** with Zod validation for type-safe database operations
- **PostgreSQL** as the primary database with migration support

### UI Components
- **Modular component structure** with reusable UI primitives
- **Responsive design** optimized for mobile and desktop
- **Accessibility features** built into component library
- **Smooth animations** and transitions for enhanced user experience

## Data Flow

### GitHub Integration
1. Client requests project data through TanStack Query
2. Server proxies requests to GitHub API with optional authentication
3. Data is filtered, sorted, and cached for optimal performance
4. Projects are displayed with live repository information

### Portfolio Sections
- **Hero Section**: Professional introduction with contact actions
- **About Section**: Career overview and key statistics
- **Experience Section**: Professional work history with technologies
- **Skills Section**: Technical competencies with progress indicators
- **Projects Section**: Dynamic GitHub repository showcase
- **Education Section**: Academic background and certifications
- **Contact Section**: Contact form with validation (ready for backend integration)

### Theme Management
- **System preference detection** with manual override capability
- **Local storage persistence** for user theme preferences
- **CSS custom properties** for seamless theme transitions
- **Component-level theme awareness** throughout the application

## External Dependencies

### Core Dependencies
- **React ecosystem**: React, React DOM, Wouter for routing
- **State management**: TanStack Query for server state
- **UI framework**: Radix UI primitives with shadcn/ui components
- **Styling**: Tailwind CSS with PostCSS processing
- **Database**: Drizzle ORM with PostgreSQL driver (@neondatabase/serverless)
- **Validation**: Zod for schema validation and type inference

### Development Tools
- **Build system**: Vite with React plugin and TypeScript support
- **Code quality**: TypeScript for static type checking
- **Replit integration**: Development banner and error overlay plugins
- **Hot reloading**: Vite dev server with Express middleware integration

### External APIs
- **GitHub API**: Repository data fetching with rate limiting considerations
- **Optional GitHub token**: For increased API rate limits in production

## Deployment Strategy

### Development Environment
- **Replit-optimized**: Configured for seamless Replit development experience
- **Hot reloading**: Instant feedback during development
- **Environment variables**: Support for DATABASE_URL and GITHUB_TOKEN
- **Port configuration**: Fixed ports for consistent development access

### Production Build
- **Multi-stage build**: Separate client and server build processes
- **Static asset optimization**: Vite production build with asset optimization
- **Server bundling**: ESBuild for efficient server-side bundling
- **Environment-specific configurations**: Development vs production settings

### Database Deployment
- **Drizzle migrations**: Version-controlled database schema changes
- **PostgreSQL compatibility**: Ready for various PostgreSQL providers
- **Connection pooling**: Configured for production database connections
- **Schema validation**: Runtime validation with Drizzle and Zod

### Performance Considerations
- **Code splitting**: Automatic code splitting with Vite
- **Asset optimization**: Image and asset optimization for fast loading
- **Caching strategies**: Query caching with TanStack Query
- **Bundle analysis**: Production bundle optimization

## Changelog
- June 27, 2025. Reverted to English-only portfolio
  - Removed multi-language support system as requested by user
  - Restored all components to clean English-only versions
  - Removed language context provider and translation files
  - Removed language switcher from navigation
  - All sections now display in English with improved content:
    * Hero section with professional introduction and animated text
    * About section with clear statistics and descriptions
    * Experience section with detailed job descriptions
    * Skills section with comprehensive technical abilities
    * Projects section with project descriptions and technologies
    * Education section with degrees, institutions, and downloadable certificates
    * Contact section with working contact form
  - Maintained Google Analytics tracking for visitor insights
  - Preserved dark mode as default theme preference
- June 26, 2025. Integrated Google Analytics for visitor tracking
  - Added comprehensive visitor analytics with Google Analytics 4
  - Implemented tracking for LinkedIn profile visitors and portfolio visits
  - Added event tracking for CV downloads, certificate downloads, and social media clicks
  - Enhanced contact form with submission tracking (success/error events)
  - Implemented navigation tracking to monitor section engagement
  - Added theme toggle tracking to understand user preferences
  - Created analytics utility files for page views and custom events
  - All tracking events properly labeled for detailed visitor insights
- June 26, 2025. Updated CV download file
  - Replaced old CV file with new "Tabriz Latifov CV (4).pdf"
  - Updated public assets folder with the latest CV version
  - Download CV button in hero section now serves the updated document
- June 26, 2025. Updated ECommerceMicroservice project image
  - Replaced with ECommerceMicroservicePicture.png showing organic food e-commerce website
  - Features vegetables, shopping cart, and "Organic Foods at your Doorsteps" design
- June 26, 2025. Added professional profile image
  - Moved MyPC3_1750782360229.png from attached_assets to client/src/assets/profile-image.png
  - Updated hero section to display professional photo with city skyline background
  - Photo shows Tabriz in Tokyo shirt with modern cityscape behind
  - Enhanced visual appeal of hero section with personal branding
- June 26, 2025. Enhanced certificate download functionality
  - Added download functionality for 7 certificates and documents:
    * "Will artificial intelligence replace humans?" → Article PDF
    * "JavaScript Certificate" → CISCO Certificate PNG
    * "Algorithms & Data Structures" → Stanford Coursera PDF
    * "Computer Science and Programming using Python" → MITx 6.00 PDF
    * "C# Programming" → Coursera C# PDF (new certificate added)
    * "C++ Programming" → Coursera C++ PDF (new certificate added)
    * "Data Structure and OOP" → Data Structure Certificate PDF (new certificate added)
  - Implemented CV download button in hero section
  - Added download icons with hover effects to all downloadable items
  - Enhanced education achievements section with comprehensive download system
- June 24, 2025. Initial setup

## User Preferences
Preferred communication style: Simple, everyday language.
Default theme: Dark mode - website should open in dark mode by default.