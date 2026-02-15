import { deletePhotoFromServer } from "./src/utils/deleteImage";
//http://app.15may.club/uploads/competitionsImages/53fe716b-3db0-48b9-8c0e-2814045e7d08.jpeg
console.log(
  new URL(
    "http://app.15may.club/uploads/competitionsImages/53fe716b-3db0-48b9-8c0e-2814045e7d08.jpeg"
  ).pathname
);
//   const deleted =  deletePhotoFromServer(
//     new URL(competitionExists.mainImagepath).pathname
//   );
