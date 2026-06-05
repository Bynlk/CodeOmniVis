# OmniVis Demo

This demo project demonstrates OmniVis capabilities with a realistic full-stack application structure.

## Structure

- **Prisma Schema**: 7 models (User, Profile, Post, Comment, Tag, Booking)
- **Next.js App Router**: Pages and API routes
- **tRPC**: Router definitions
- **React Components**: Component tree

## Running the Demo

```bash
# From the project root
npx omnivis serve
```

Then open http://localhost:4321 to see the architecture visualization.

## Expected Output

The visualization should show:
- 7 DB Model nodes (User, Profile, Post, Comment, Tag, Booking)
- Multiple relation edges between models
- Hierarchical layout with DB models at the bottom
