import { cancelRender, getJob } from "@/lib/render-queue";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  return Response.json(job);
}

/**
 * Stop a render.
 *
 * The dialog's "Stop render" used to call the same function as "Hide and keep
 * working" — so the only thing it stopped was the dialog.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const stopped = cancelRender(jobId);
  return Response.json({ stopped, status: getJob(jobId)?.status });
}
