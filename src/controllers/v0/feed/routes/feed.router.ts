import { Router, Request, Response } from 'express';
import { FeedItem } from '../models/FeedItem';
import { requireAuth } from '../../users/routes/auth.router';
import * as AWS from '../../../../aws';

const router: Router = Router();

// Get all feed items
router.get('/', async (req: Request, res: Response) => {
    const items = await FeedItem.findAndCountAll({order: [['id', 'DESC']]});
    items.rows.map((item) => {
            if(item.url) {
                item.url = AWS.getGetSignedUrl(item.url);
            }
    });
    res.send(items);
});

//RMHL
//Add an endpoint to GET a specific resource by Primary Key
router.get('/:id', async (req: Request, res: Response) => {
  let { id } = req.params;//Get the id from params
  if (!id) {
      return res.status(400).send({ message: 'id of resource is missing or malformed!!' });
  }
  const item = await FeedItem.findByPk(id);
  if (item===null){
    return res.status(404).send({ message: 'No record found for this ID' });
  }
  res.status(200).send(item);//http code 200 indicates OK
});

//RMHL
// update a specific resource
router.patch('/:id',
    requireAuth,
    async (req: Request, res: Response) => {
    let { id } = req.params;//Get the id from params
    const caption = req.body.caption;//Get the caption from body
    const fileName = req.body.url;//Get the url from body
    console.log("The id is: "+id);

    if (!caption && !fileName){
        return res.status(400).send({ message: 'Caption and / or URL required or malformed' });
    }
    //Note: don't need to make dictionary customised to request body content as
    //missing fields are ignored when the update takes place DB side.
    //const [numberOfAffectedRows, affectedRows]
    const result = await FeedItem.update(
      { caption: caption,
        url: fileName
      },
      { where: { id: id }, returning: true },).then(() => {
        console.log('Record Updated');
      }).catch(err => console.log(err));
    
    console.log("Returned: "+result);
    console.log("Returned is Array: "+Array.isArray(result));

    res.status(202).send(result);//http code 202 indicates accepted
});


// Get a signed url to put a new item in the bucket
router.get('/signed-url/:fileName',
    requireAuth,
    async (req: Request, res: Response) => {
    let { fileName } = req.params;
    const url = AWS.getPutSignedUrl(fileName);
    res.status(201).send({url: url});
});

// Post meta data and the filename after a file is uploaded
// NOTE the file name is they key name in the s3 bucket.
// body : {caption: string, fileName: string};
router.post('/',
    requireAuth,
    async (req: Request, res: Response) => {
    const caption = req.body.caption;
    const fileName = req.body.url;

    // check Caption is valid
    if (!caption) {
        return res.status(400).send({ message: 'Caption is required or malformed' });
    }

    // check Filename is valid
    if (!fileName) {
        return res.status(400).send({ message: 'File url is required' });
    }

    const item = await new FeedItem({
            caption: caption,
            url: fileName
    });

    const saved_item = await item.save();

    saved_item.url = AWS.getGetSignedUrl(saved_item.url);
    res.status(201).send(saved_item);
});

export const FeedRouter: Router = router;
