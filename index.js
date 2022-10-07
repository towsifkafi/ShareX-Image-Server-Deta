require('dotenv').config()
const { Deta } = require('deta')
const upload = require("express-fileupload");
const express = require('express')
var uniqid = require('uniqid'); 
const app = express()
const fs = require('fs')

app.use(upload());

const deta = Deta()
const images = deta.Base('images_data')
const drive = deta.Drive('images')

const allowed_filetypes = ["image/apng", "image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]

app.get('/sharex', async (req, res) => {

    let host = req.get('host');

    let client_config = {
        "Version": "14.1.0",
        "Name": `${host}`,
        "DestinationType": "ImageUploader",
        "RequestMethod": "POST",
        "RequestURL": `${req.secure ? 'https://' : 'http://'}${host}/upload`,
        "Headers": {
            "key": ""
        },
        "Body": "MultipartFormData",
        "FileFormName": "image",
        "URL": "{json:url}"
    }

    var encoded = btoa(JSON.stringify(client_config))

    res.writeHead(200, {
        'Content-Disposition': `attachment; filename="${host}.sxcu"`,
        'Content-Type': `text/json`,
    })

    const download = Buffer.from(encoded, 'base64')
    res.end(download)

})

app.get('/:id', async (req, res) => {

    let id = req.params.id;
    id = id.split('.')[0]

    let imgData = await images.get(id)
    if(!imgData) return res.send({ error: true, msg: "Not Found" })

    let template = fs.readFileSync('./template.html', 'utf-8')

    console.log(imgData)

    let date = new Date(parseInt(imgData.timestamp))
    
    template = template
        .replace(/{FILE_NAME}/g, imgData.name)
        .replace(/{URL}/g, imgData.preview_url)
        .replace(/{DL_URL}/g, imgData.dl_url)
        .replace(/{UPLOAD_DATE}/g, `${date.toLocaleDateString("default")} - ${date.toLocaleTimeString("default")}`)

    res.setHeader('Content-Type', `text/html`)
    res.send(template)

})

app.get('/i/:id', async (req, res) => {

    let id = req.params.id;
    id = id.split('.')[0]

    let imgData = await images.get(id)
    if(!imgData) return res.send({ error: true, msg: "Not Found" })

    console.log(id, imgData)

    let img = await drive.get(`${id}.${imgData.type}`);

    if(!img) return res.send({ error: true, msg: "Image Not Found." })

    let buffer = await img.arrayBuffer();
    let data = Buffer.from(buffer)

    res.setHeader('Content-Type', `image/${imgData.type}`)
    res.send(data)

})

app.get('/download/:id', async (req, res) => {
    
    let id = req.params.id;
    id = id.split('.')[0]

    let imgData = await images.get(id)
    if(!imgData) return res.send({ error: true, msg: "Not Found" })

    console.log(id, imgData)

    let img = await drive.get(`${id}.${imgData.type}`);

    if(!img) return res.send({ error: true, msg: "Image Not Found." })

    let buffer = await img.arrayBuffer();
    let data = Buffer.from(buffer)

    res.writeHead(200, {
        'Content-Disposition': `attachment; filename="${imgData.name.split(".")[0]}.${imgData.type}"`,
        'Content-Type': `image/${imgData.type}`,
    })

    res.end(data);

})

app.post('/upload', async (req, res) => {

    //console.log(req.files.image)

    if(!req.headers.key || req.headers.key !== process.env.ENV_UPLOAD_KEY) return res.send({ error: true, msg: "Unauthorized. Invalid Key" })

    let id = await generateId()

    let name = req.files.image.name;
    let contents = req.files.image.data;
    let type = req.files.image.mimetype
    var host = req.get('host')
    
    if(!allowed_filetypes.includes(type)) return res.send({ error: true, msg : "Unsupported Filetype." })
    type = type.split("/")[1]
    
    let data = {
        key: id,
        name: name ? name : `${id}.${type}`,
        url: `${req.secure ? 'https://' : 'http://'}${host}/${id}`,
        preview_url: `${req.secure ? 'https://' : 'http://'}${host}/i/${id}`,
        dl_url: `${req.secure ? 'https://' : 'http://'}${host}/download/${id}`,
        type: `${type}`,
        timestamp: `${Date.now()}`
    }
    
    console.log(data)
    
    let image = await images.put(data)
    let img = await drive.put(`${id}.${type}`, {data: contents});

    res.send(data);
})



const generateId = async() => {
    let id = await uniqid.time()
    let found = await images.get(id)
    if(found) {
        return await generateId()
    } else {
        return id
    }
}


// export 'app'
module.exports = app

app.listen(3000)