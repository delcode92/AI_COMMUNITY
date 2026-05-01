import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(`${process.env.BACKEND_URL || 'http://localhost:5000'}/api/skills`);
    const skills = await response.json();
    return NextResponse.json(skills);
  } catch (error) {
    // Return mock skills if backend unavailable
    return NextResponse.json([
      { id: 'science', name: 'Science Guide', description: 'Explore scientific concepts' },
      { id: 'math', name: 'Math Tutor', description: 'Understand mathematical concepts' },
      { id: 'physics', name: 'Physics Explorer', description: 'Learn about physics' },
      { id: 'programming', name: 'Coding Coach', description: 'Learn programming' },
      { id: 'ai-ml', name: 'AI/ML Guide', description: 'Understand AI/ML' },
    ]);
  }
}
