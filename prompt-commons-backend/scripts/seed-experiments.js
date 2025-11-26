// scripts/seed-experiments.js
// 테스트 실험 20개 생성 스크립트
// 실행: node scripts/seed-experiments.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const testExperiments = [
  {
    title: "Code Review Assistant",
    aiModel: "GPT-4",
    modelVersion: "gpt-4-turbo-2024-04-09",
    taskType: "Code Review",
    promptText: "You are an expert code reviewer. Review the following code for:\n1. Code quality and best practices\n2. Potential bugs or errors\n3. Performance optimizations\n4. Security vulnerabilities\n\nProvide specific, actionable feedback with code examples where appropriate.\n\nCode to review:\n{{CODE}}",
    promptDescription: "A comprehensive code review assistant that analyzes code for quality, bugs, performance, and security issues.",
    modificationGuide: "Replace {{CODE}} with the code you want to review. You can add specific focus areas by appending them to the list.",
    tags: ["code-review", "development", "best-practices"]
  },
  {
    title: "SQL Query Optimizer",
    aiModel: "Claude-3.5",
    modelVersion: "claude-3-5-sonnet-20241022",
    taskType: "Database",
    promptText: "Analyze and optimize the following SQL query for better performance:\n\n{{SQL_QUERY}}\n\nProvide:\n1. Explanation of current query issues\n2. Optimized version of the query\n3. Index recommendations\n4. Estimated performance improvement",
    promptDescription: "Helps optimize SQL queries by identifying bottlenecks and suggesting improvements.",
    modificationGuide: "Insert your SQL query in place of {{SQL_QUERY}}. Works best with complex queries involving JOINs and subqueries.",
    tags: ["sql", "database", "optimization", "performance"]
  },
  {
    title: "API Documentation Generator",
    aiModel: "GPT-4o",
    modelVersion: "gpt-4o-2024-08-06",
    taskType: "Documentation",
    promptText: "Generate comprehensive API documentation for the following endpoint:\n\nEndpoint: {{ENDPOINT}}\nMethod: {{METHOD}}\nDescription: {{DESCRIPTION}}\n\nInclude:\n- Request parameters\n- Request body schema\n- Response schema\n- Example request/response\n- Error codes\n- Authentication requirements",
    promptDescription: "Automatically generates professional API documentation from endpoint specifications.",
    modificationGuide: "Fill in the endpoint details. Add authentication info if needed.",
    tags: ["api", "documentation", "swagger", "openapi"]
  },
  {
    title: "Unit Test Generator",
    aiModel: "Claude-3",
    modelVersion: "claude-3-opus-20240229",
    taskType: "Testing",
    promptText: "Generate comprehensive unit tests for the following function:\n\n{{FUNCTION_CODE}}\n\nRequirements:\n- Use {{TEST_FRAMEWORK}} framework\n- Cover edge cases\n- Include positive and negative test cases\n- Mock external dependencies\n- Aim for >90% code coverage",
    promptDescription: "Creates thorough unit tests with edge case coverage for any function.",
    modificationGuide: "Replace {{FUNCTION_CODE}} with your function and {{TEST_FRAMEWORK}} with Jest, Pytest, JUnit, etc.",
    tags: ["testing", "unit-test", "tdd", "coverage"]
  },
  {
    title: "Git Commit Message Writer",
    aiModel: "GPT-4",
    modelVersion: "gpt-4-turbo-2024-04-09",
    taskType: "Git",
    promptText: "Write a conventional commit message for the following changes:\n\n{{DIFF}}\n\nFollow these rules:\n- Use conventional commits format (type(scope): description)\n- Keep subject line under 50 characters\n- Add body explaining why, not what\n- Reference related issues if applicable",
    promptDescription: "Generates professional git commit messages following conventional commits specification.",
    modificationGuide: "Paste your git diff output. The prompt will analyze changes and suggest an appropriate commit message.",
    tags: ["git", "commit", "conventional-commits"]
  },
  {
    title: "React Component Generator",
    aiModel: "Claude-3.5",
    modelVersion: "claude-3-5-sonnet-20241022",
    taskType: "Frontend",
    promptText: "Create a React component with the following specifications:\n\nComponent Name: {{NAME}}\nDescription: {{DESCRIPTION}}\nProps: {{PROPS}}\n\nRequirements:\n- Use TypeScript\n- Include PropTypes/interface\n- Add JSDoc comments\n- Follow React best practices\n- Include basic styling with CSS modules or styled-components",
    promptDescription: "Generates production-ready React components with TypeScript and best practices.",
    modificationGuide: "Specify component name, description, and required props. Can add state requirements.",
    tags: ["react", "typescript", "frontend", "component"]
  },
  {
    title: "Error Message Explainer",
    aiModel: "GPT-4o",
    modelVersion: "gpt-4o-2024-08-06",
    taskType: "Debugging",
    promptText: "Explain the following error message and provide solutions:\n\nError: {{ERROR_MESSAGE}}\nContext: {{CONTEXT}}\nStack trace: {{STACK_TRACE}}\n\nProvide:\n1. What this error means\n2. Common causes\n3. Step-by-step solution\n4. Prevention tips",
    promptDescription: "Helps developers understand cryptic error messages and provides actionable solutions.",
    modificationGuide: "Paste the full error message and any relevant context. Stack trace is optional but helpful.",
    tags: ["debugging", "error-handling", "troubleshooting"]
  },
  {
    title: "Database Schema Designer",
    aiModel: "Claude-3",
    modelVersion: "claude-3-opus-20240229",
    taskType: "Database",
    promptText: "Design a database schema for the following requirements:\n\n{{REQUIREMENTS}}\n\nProvide:\n1. Entity-Relationship diagram (text representation)\n2. SQL CREATE TABLE statements\n3. Index recommendations\n4. Normalization notes\n5. Sample queries for common operations",
    promptDescription: "Creates optimized database schemas from business requirements.",
    modificationGuide: "Describe your data requirements in plain English. Include relationships between entities.",
    tags: ["database", "schema", "sql", "design"]
  },
  {
    title: "REST API Designer",
    aiModel: "GPT-4",
    modelVersion: "gpt-4-turbo-2024-04-09",
    taskType: "API Design",
    promptText: "Design a RESTful API for the following use case:\n\n{{USE_CASE}}\n\nInclude:\n1. Resource endpoints (CRUD operations)\n2. HTTP methods and status codes\n3. Request/Response schemas\n4. Authentication approach\n5. Pagination and filtering\n6. Rate limiting considerations",
    promptDescription: "Designs complete REST APIs following industry best practices.",
    modificationGuide: "Describe your application's functionality. Specify any constraints or requirements.",
    tags: ["api", "rest", "backend", "design"]
  },
  {
    title: "Code Refactoring Assistant",
    aiModel: "Claude-3.5",
    modelVersion: "claude-3-5-sonnet-20241022",
    taskType: "Refactoring",
    promptText: "Refactor the following code to improve:\n\n{{CODE}}\n\nFocus areas:\n- {{FOCUS_AREAS}}\n\nProvide:\n1. Refactored code\n2. Explanation of changes\n3. Design patterns applied\n4. Before/after comparison",
    promptDescription: "Refactors code with explanations of improvements and patterns used.",
    modificationGuide: "Paste code and specify focus areas like 'readability', 'performance', 'SOLID principles', etc.",
    tags: ["refactoring", "clean-code", "design-patterns"]
  },
  {
    title: "Regex Pattern Generator",
    aiModel: "GPT-4o",
    modelVersion: "gpt-4o-2024-08-06",
    taskType: "Utilities",
    promptText: "Create a regex pattern for:\n\n{{DESCRIPTION}}\n\nProvide:\n1. The regex pattern\n2. Explanation of each part\n3. Test cases (matching and non-matching)\n4. Common edge cases\n5. Language-specific notes (if applicable)",
    promptDescription: "Generates regex patterns with detailed explanations and test cases.",
    modificationGuide: "Describe what you want to match in plain English. Include examples if possible.",
    tags: ["regex", "pattern-matching", "validation"]
  },
  {
    title: "Docker Compose Generator",
    aiModel: "Claude-3",
    modelVersion: "claude-3-opus-20240229",
    taskType: "DevOps",
    promptText: "Generate a Docker Compose configuration for:\n\n{{STACK_DESCRIPTION}}\n\nInclude:\n1. docker-compose.yml\n2. Dockerfile for custom images\n3. Environment variables\n4. Volume mappings\n5. Network configuration\n6. Health checks",
    promptDescription: "Creates complete Docker Compose setups for various development stacks.",
    modificationGuide: "Describe your tech stack (e.g., 'Node.js app with PostgreSQL and Redis').",
    tags: ["docker", "devops", "containers", "infrastructure"]
  },
  {
    title: "CI/CD Pipeline Designer",
    aiModel: "GPT-4",
    modelVersion: "gpt-4-turbo-2024-04-09",
    taskType: "DevOps",
    promptText: "Design a CI/CD pipeline for:\n\nProject type: {{PROJECT_TYPE}}\nPlatform: {{PLATFORM}}\nRequirements: {{REQUIREMENTS}}\n\nProvide:\n1. Pipeline configuration file\n2. Stage descriptions\n3. Environment setup\n4. Testing strategy\n5. Deployment strategy\n6. Rollback plan",
    promptDescription: "Designs complete CI/CD pipelines for GitHub Actions, GitLab CI, or Jenkins.",
    modificationGuide: "Specify project type, CI platform, and any specific requirements like staging environments.",
    tags: ["cicd", "devops", "automation", "deployment"]
  },
  {
    title: "Security Audit Checklist",
    aiModel: "Claude-3.5",
    modelVersion: "claude-3-5-sonnet-20241022",
    taskType: "Security",
    promptText: "Perform a security audit on the following code/configuration:\n\n{{CODE_OR_CONFIG}}\n\nCheck for:\n1. OWASP Top 10 vulnerabilities\n2. Authentication/Authorization issues\n3. Data validation problems\n4. Sensitive data exposure\n5. Security misconfigurations\n\nProvide severity ratings and remediation steps.",
    promptDescription: "Identifies security vulnerabilities and provides remediation guidance.",
    modificationGuide: "Paste code, configuration files, or architecture descriptions for review.",
    tags: ["security", "audit", "owasp", "vulnerabilities"]
  },
  {
    title: "Performance Optimization Guide",
    aiModel: "GPT-4o",
    modelVersion: "gpt-4o-2024-08-06",
    taskType: "Performance",
    promptText: "Analyze and optimize the performance of:\n\n{{CODE_OR_SYSTEM}}\n\nContext: {{CONTEXT}}\n\nProvide:\n1. Performance bottleneck analysis\n2. Optimization recommendations\n3. Before/after complexity analysis\n4. Benchmarking suggestions\n5. Trade-offs to consider",
    promptDescription: "Identifies performance bottlenecks and suggests optimizations.",
    modificationGuide: "Include code, system architecture, or describe the performance issue you're facing.",
    tags: ["performance", "optimization", "benchmarking"]
  },
  {
    title: "Technical Interview Prep",
    aiModel: "Claude-3",
    modelVersion: "claude-3-opus-20240229",
    taskType: "Learning",
    promptText: "Create technical interview questions for:\n\nRole: {{ROLE}}\nLevel: {{LEVEL}}\nFocus areas: {{FOCUS_AREAS}}\n\nProvide:\n1. Coding challenges with solutions\n2. System design questions\n3. Behavioral questions\n4. Expected answers and evaluation criteria\n5. Follow-up questions",
    promptDescription: "Generates comprehensive technical interview questions with model answers.",
    modificationGuide: "Specify role (e.g., 'Senior Backend Engineer'), level, and areas to focus on.",
    tags: ["interview", "career", "hiring", "assessment"]
  },
  {
    title: "Code Documentation Generator",
    aiModel: "GPT-4",
    modelVersion: "gpt-4-turbo-2024-04-09",
    taskType: "Documentation",
    promptText: "Generate comprehensive documentation for:\n\n{{CODE}}\n\nInclude:\n1. JSDoc/Docstring comments\n2. README section\n3. Usage examples\n4. API reference\n5. Architecture overview\n6. Contributing guidelines",
    promptDescription: "Creates thorough documentation from code with examples and guides.",
    modificationGuide: "Paste your code. Specify documentation format preferences if needed.",
    tags: ["documentation", "jsdoc", "readme", "api-docs"]
  },
  {
    title: "Microservices Architecture Planner",
    aiModel: "Claude-3.5",
    modelVersion: "claude-3-5-sonnet-20241022",
    taskType: "Architecture",
    promptText: "Design a microservices architecture for:\n\n{{SYSTEM_REQUIREMENTS}}\n\nProvide:\n1. Service decomposition\n2. API contracts between services\n3. Data management strategy\n4. Communication patterns (sync/async)\n5. Service discovery approach\n6. Monitoring and logging strategy",
    promptDescription: "Plans microservices architectures with communication and data strategies.",
    modificationGuide: "Describe your system requirements and scale expectations.",
    tags: ["microservices", "architecture", "distributed-systems"]
  },
  {
    title: "Migration Script Generator",
    aiModel: "GPT-4o",
    modelVersion: "gpt-4o-2024-08-06",
    taskType: "Migration",
    promptText: "Generate a migration script from:\n\nSource: {{SOURCE}}\nTarget: {{TARGET}}\nData: {{DATA_DESCRIPTION}}\n\nProvide:\n1. Migration script\n2. Rollback script\n3. Data validation queries\n4. Testing checklist\n5. Estimated downtime\n6. Risk assessment",
    promptDescription: "Creates database or system migration scripts with rollback plans.",
    modificationGuide: "Specify source and target systems, and describe the data being migrated.",
    tags: ["migration", "database", "data-transfer"]
  },
  {
    title: "Logging Strategy Designer",
    aiModel: "Claude-3",
    modelVersion: "claude-3-opus-20240229",
    taskType: "Observability",
    promptText: "Design a logging strategy for:\n\n{{APPLICATION_TYPE}}\n\nInclude:\n1. Log levels and when to use each\n2. Structured logging format\n3. Log aggregation approach\n4. Retention policies\n5. Alert rules\n6. Privacy considerations\n7. Sample log statements",
    promptDescription: "Creates comprehensive logging strategies for applications.",
    modificationGuide: "Describe your application type and any compliance requirements.",
    tags: ["logging", "observability", "monitoring", "debugging"]
  }
];

async function seedExperiments() {
  const userId = BigInt(3); // userid 3

  console.log('Starting to seed 20 test experiments for user ID 3...\n');

  for (let i = 0; i < testExperiments.length; i++) {
    const exp = testExperiments[i];

    try {
      // 트랜잭션으로 Experiment + Version + Tags 생성
      const result = await prisma.$transaction(async (tx) => {
        // 1. Experiment 생성
        const experiment = await tx.experiment.create({
          data: {
            authorId: userId,
            title: exp.title,
            taskType: exp.taskType,
          }
        });

        // 2. Version 생성
        const version = await tx.experimentVersion.create({
          data: {
            experimentId: experiment.id,
            versionNumber: 'v1.0',
            promptText: exp.promptText,
            promptDescription: exp.promptDescription,
            modificationGuide: exp.modificationGuide,
            aiModel: exp.aiModel,
            modelVersion: exp.modelVersion,
            changelog: 'Initial release',
            reproductionRate: Math.floor(Math.random() * 30) + 70, // 70-99 랜덤
            reproductionCount: Math.floor(Math.random() * 50) + 5, // 5-54 랜덤
            viewCount: Math.floor(Math.random() * 500) + 100, // 100-599 랜덤
          }
        });

        // 3. Tags 생성
        for (const tagName of exp.tags) {
          await tx.experimentTag.create({
            data: {
              versionId: version.id,
              tagName: tagName
            }
          });
        }

        // 4. activeVersionId 업데이트
        await tx.experiment.update({
          where: { id: experiment.id },
          data: { activeVersionId: version.id }
        });

        return experiment;
      });

      console.log(`✅ [${i + 1}/20] Created: ${exp.title}`);
    } catch (error) {
      console.error(`❌ [${i + 1}/20] Failed to create: ${exp.title}`);
      console.error(error.message);
    }
  }

  console.log('\n✨ Seeding completed!');
}

seedExperiments()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
