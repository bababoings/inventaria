import { useState, useCallback } from "react";
import { Upload, AlertCircle, CheckCircle, FileWarning, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { parseCSV, readFileAsText, CSVRow, ValidationResult } from "@/lib/csv";
import { cn } from "@/lib/utils";

interface CSVImportDialogProps<T extends CSVRow> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  expectedColumns: { key: string; header: string; required?: boolean }[];
  validator: (row: CSVRow, index: number) => string[];
  onImport: (validRows: T[]) => void;
}

export function CSVImportDialog<T extends CSVRow>({
  open,
  onOpenChange,
  title,
  description,
  expectedColumns,
  validator,
  onImport,
}: CSVImportDialogProps<T>) {
  const [file, setFile] = useState<File | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult<CSVRow>[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const validRows = validationResults.filter((r) => r.isValid);
  const invalidRows = validationResults.filter((r) => !r.isValid);

  const handleFile = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile);
      setParseErrors([]);
      setValidationResults([]);

      try {
        const content = await readFileAsText(selectedFile);
        const { rows, errors } = parseCSV(content);

        if (errors.length > 0) {
          setParseErrors(errors);
        }

        // Validate each row
        const results: ValidationResult<CSVRow>[] = rows.map((row, index) => {
          const validationErrors = validator(row, index);
          return {
            row,
            rowIndex: index,
            isValid: validationErrors.length === 0,
            errors: validationErrors,
          };
        });

        setValidationResults(results);
      } catch (error) {
        setParseErrors(["Failed to read file"]);
      }
    },
    [validator]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile?.type === "text/csv" || droppedFile?.name.endsWith(".csv")) {
        handleFile(droppedFile);
      }
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFile(selectedFile);
      }
    },
    [handleFile]
  );

  const handleImport = () => {
    onImport(validRows.map((r) => r.row) as T[]);
    handleClose();
  };

  const handleClose = () => {
    setFile(null);
    setParseErrors([]);
    setValidationResults([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!file ? (
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop a CSV file, or click to select
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileInput}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload">
              <Button variant="outline" asChild>
                <span>Select File</span>
              </Button>
            </label>
            <div className="mt-4 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Expected columns:</p>
              <p>{expectedColumns.map((c) => c.header).join(", ")}</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 space-y-4">
            {/* File info */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{file.name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Parse errors */}
            {parseErrors.length > 0 && (
              <div className="p-3 bg-destructive/10 rounded-lg">
                <p className="text-sm font-medium text-destructive mb-1">Parse Errors</p>
                {parseErrors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">
                    {err}
                  </p>
                ))}
              </div>
            )}

            {/* Summary */}
            {validationResults.length > 0 && (
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>{validRows.length} valid rows</span>
                </div>
                {invalidRows.length > 0 && (
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span>{invalidRows.length} invalid rows</span>
                  </div>
                )}
              </div>
            )}

            {/* Preview table */}
            {validationResults.length > 0 && (
              <ScrollArea className="h-64 rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Status</TableHead>
                      {expectedColumns.map((col) => (
                        <TableHead key={col.key}>{col.header}</TableHead>
                      ))}
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationResults.map((result, i) => (
                      <TableRow
                        key={i}
                        className={cn(!result.isValid && "bg-destructive/5")}
                      >
                        <TableCell>
                          {result.isValid ? (
                            <Badge variant="outline" className="text-success border-success">
                              Valid
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Invalid</Badge>
                          )}
                        </TableCell>
                        {expectedColumns.map((col) => (
                          <TableCell key={col.key} className="text-sm">
                            {String(result.row[col.key] ?? "")}
                          </TableCell>
                        ))}
                        <TableCell className="text-xs text-destructive">
                          {result.errors.join("; ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={validRows.length === 0}>
            Import {validRows.length} Row{validRows.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
