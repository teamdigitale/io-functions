import * as azure from "azure-storage";
import { Option, option } from "ts-option";
import { Either, left, right } from "./either";

const STORAGE_CONNECTION_STRING = process.env.AzureWebJobsStorage;
const defaultBlobService = azure.createBlobService(STORAGE_CONNECTION_STRING);

export function getBlobUrl(
  containerName: string,
  attachmentName: string,
  blobService: azure.BlobService = defaultBlobService
): string {
  return blobService.getUrl(containerName, attachmentName);
}

/**
 * Create a new blob (media). 
 * Assumes that the container <containerName> already exists.
 * 
 * 
 * @param blobName 
 * @param text 
 */
export function upsertBlobFromText(
  containerName: string,
  blobName: string,
  text: string | Buffer,
  blobService: azure.BlobService = defaultBlobService
): Promise<Either<Error, Option<azure.BlobService.BlobResult>>> {
  return new Promise((resolve, _) =>
    blobService.createBlockBlobFromText(
      containerName,
      blobName,
      text,
      (err, result, __) => {
        if (err) {
          resolve(left(err));
        }
        resolve(right(option(result)));
      }
    )
  );
}
