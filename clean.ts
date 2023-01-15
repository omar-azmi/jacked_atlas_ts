/** clean the project directory */

const delete_dir_list: string[] = [
	"./npm/",
	"./docs/",
	"./dist/",
	/*
	"./backup",
	*/
]

const delete_file_list: string[] = [
	/*
	"./deno.lock",
	*/
]

let stat: Deno.FileInfo
for (const dir_path of delete_dir_list) {
	try { stat = Deno.statSync(dir_path) }
	catch (error) { continue }
	if (stat.isDirectory) Deno.removeSync(dir_path, { recursive: true })
}
for (const file_path of delete_file_list) {
	try { stat = Deno.statSync(file_path) }
	catch (error) { continue }
	if (stat.isFile) Deno.removeSync(file_path, { recursive: true })
}
