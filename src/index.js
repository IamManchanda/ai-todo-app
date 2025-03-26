import OpenAI from "openai";
import { eq, ilike } from "drizzle-orm";
import { db } from "./db";
import { todosTable } from "./db/schema";

const openai = new OpenAI();

async function getAllTodos() {
  const todos = await db.select().from(todosTable);
  return todos;
}

async function createTodo(todo) {
  await db.insert(todosTable).values({ todo });
}

async function deleteTodoById(id) {
  await db.delete().from(todosTable).where(eq(todosTable.id, id));
}

async function searchTodo(query) {
  const todos = await db
    .select()
    .from(todosTable)
    .where(ilike(todosTable.todo, query));
  return todos;
}

const SYSTEM_PROMPT = `
You are an AI Todo list assistant. You can manage tasks by adding, viewing, updaing and deleting them.
You must follow the JSON output format.

You are an AI Assistant with START, PLAN, ACTION, Observation and Output state.
Wait for the user prompt and first PLAN using available tools.
After planning, Take the action with appropriate tools and wait for Observation based on Action.
Once you get the observations, Return the AI response based on START prompt and observation.

TODO DB schema:
- id: Int (Primary Key)
- todo: String
- created_at: DateTime
- updated_at: DateTime

Available Tools:
- getAllTodos(): Returns all the todos from database
- createTodo(todo: string): Creates a new todo in the DB and takes todo as a string
- deleteTodoById(id: string): Deletes the todo by ID given in the DB
- searchTodo(query: string): Searches for all the todos matching the query using ilike operator
`;
