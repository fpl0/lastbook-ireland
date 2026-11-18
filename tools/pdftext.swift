// usage: pdftext file.pdf  -> JSON array of page strings on stdout
import Foundation
import PDFKit
let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let doc = PDFDocument(url: url) else { print("[]"); exit(0) }
var pages: [String] = []
for i in 0..<doc.pageCount {
    autoreleasepool { pages.append(doc.page(at: i)?.string ?? "") }
}
let data = try! JSONSerialization.data(withJSONObject: pages)
FileHandle.standardOutput.write(data)
